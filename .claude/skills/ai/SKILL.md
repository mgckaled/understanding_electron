---
name: ai
description: A camada de IA do crivo — a fronteira de rede injetável (ChatFn/ProbeFn/ModelsFn), o orçamento de RAM (KV cache por token) e de tokens (calibração, faixas de contexto, ancoramento pós-fato), a armadilha `/api/tags` vs `/api/show`, o contrato único de streaming/raciocínio/motivo-de-parada sobre três provedores (Ollama, Gemini, GLM), e o limite de privacidade nível 1/2/3 na tradução de mensagem para prompt. Use ao tocar `src/core/ai/`, `src/main/features/ai/`, decidir orçamento de contexto, adicionar provedor ou expor uma capacidade nova. Não cobre a frota Ollama instalada nem o catálogo de nuvem (`docs/reference/models/`), nem o contrato dos canais `ai:*` (skill `ipc`).
---

# Camada de IA — crivo

> Frota Ollama instalada, peso, cache KV por faixa de contexto, ficha técnica de modelo de nuvem: [`docs/reference/models/`](../../../docs/reference/models/README.md) — fronteira deliberada, não reaberta aqui (R6.1). Investigação já incorporada ao código do arco 21 (as três APIs, os achados medidos): [`docs/reference/reasoning/`](../../../docs/reference/reasoning/README.md). Contrato dos canais `ai:*` (`isAvailable`, `models`, `loaded`, `unload`, `chat`, `propose`), `Result` vs exceção na fronteira IPC: skill [`ipc`](../ipc/SKILL.md). `CapabilityChip`/`ModelSelector`: skill [`design-system`](../design-system/SKILL.md). Camadas e regra de importação: skill [`architecture`](../architecture/SKILL.md).

## Escolha de modelo nesta frota, e o protocolo de sonda (migrado de `CLAUDE.md`, R-6)

O que decide escolha, em uma linha cada: `gemma3:4b` é o **default** e o único com visão · `gemma3:1b` é o fallback de baixa RAM · `qwen2.5-coder:3b` é o candidato a default do NL→SQL (único que junta código e folga de RAM) · `qwen3:4b` é o único com `thinking`, e o cache mais caro da frota. Ficha técnica completa de cada um (peso, teto, KV/token): [`docs/reference/models/`](../../../docs/reference/models/README.md) — esta skill decide qual usar, aquele diretório decide o custo de usá-lo.

⚠️ **Ao sondar o Ollama, um modelo residente por vez.** `keep_alive` de no máximo 1, e descarregar explicitamente com `keep_alive: 0` entre medidas — o default é 5 minutos, então modelos se acumulam em silêncio ao longo de sondas sucessivas, e dois residentes nesta máquina é *swap*. `ollama ps` vazio antes de começar e ao terminar. `/api/tags` e `/api/show` são metadados e **não** carregam nada, então catálogo é sempre seguro; o que exige o protocolo é inferência. Carregar o `gemma3:4b` do disco frio custa **~50 s**, o preço real de trocar de modelo.

## A fronteira de rede é injetável, e é por isso que `core/` testa sem Ollama instalado

`src/core/ai/types.ts` declara cinco seams — `ChatFn`, `ProbeFn`, `ModelsFn`, `LoadedFn`, `UnloadFn` — e nada em `core/` sabe qual provedor os cumpre (D9.2). Os adaptadores concretos vivem em `src/main/features/ai/providers/{ollama,gemini,glm}.ts`; `src/main/ipc/register-all.ts` escolhe um por `resolveProvider(service)` e injeta nos handlers de `src/main/features/ai/handlers.ts`. É a mesma forma do `make_llm_fn` do mill.tools, e o motivo de o nível 1 (`core/ai/*.test.ts`) rodar sem nenhum serviço no ar.

Todo seam **lança** em vez de devolver `Result` — quem classifica a exceção em `AppError` é sempre `mapProviderError` (`handlers.ts`), o único lugar que conhece as três formas de falha (indisponível, erro upstream, timeout). Um adaptador que devolvesse `Result` duplicaria essa classificação e poderia divergir dela.

`ChatFn` resolve para `ChatReply`, nunca uma string solta: a última linha do stream carrega os contadores de token, a única contagem exata que existe (nada tokeniza antes de enviar) — é o que calibra o medidor (D15.4).

## Orçamento de RAM: quanto um modelo custa antes de qualquer token

`src/core/ai/memory.ts` — puro, sem Electron, RAM livre passada por parâmetro. A fórmula: `2 × camadas-que-crescem × kvHeads × headDim × 2 (K e V, f16) × OVERHEAD`.

- **`OVERHEAD = 1.06`** — medido, não derivado: 38,0 KB por token contra os 36,0 que a fórmula prevê, no `qwen2.5-coder:3b` (D15.8).
- **`FIXED_OVERHEAD_BYTES = 0,33 GiB`** — custo de um modelo carregado antes de qualquer contexto, medido via `ollama ps`. Maior que o cache inteiro de um modelo pequeno a 4k — ignorar subestima todo modelo em ~1/3 GB, sempre na direção perigosa.
- **`RAM_MARGIN_BYTES = 512 MiB`** — subtraído **antes** da divisão por token, não é custo fixo: tira poucos milhares de tokens de um modelo 3B e a existência inteira de um 7B (D15.10, duas medidas já usadas).
- **`growingLayers`** — todas as camadas crescem com `num_ctx` **sem** sliding window ativa; **uma só** cresce com ela ativa (empírico, `gemma3:4b`, fator 1,07 medido). A janela é comparada ao **teto do próprio modelo**, nunca ao `numCtx` candidato sendo calculado — senão a função seria recursiva sobre a própria saída (D15.8).
- **`contextCeiling(model, freeBytes, marginBytes)`** — `min(teto treinado, o que a máquina aguenta)`. `null` quando falta teto treinado **ou** dado de atenção — nunca inventa um número. `phi4-mini` declara 131072, que é 16 GB de cache numa máquina de 16 GB: oferecer só o teto treinado é o erro que parece honesto e não é.

⚠️ **`freeBytes` é lido no momento da chamada.** Esta máquina varia ~3 GB conforme o que mais roda (`CLAUDE.md` § Máquina e modelos locais); uma reserva feita ociosa nunca encolhe sozinha — é isso que a trava de janela (abaixo) existe para não deixar acontecer em silêncio.

## Orçamento de tokens: quanto a próxima mensagem custa, e se cabe

`src/core/ai/budget.ts` — só tokens cruzam daqui pra fora, nunca bytes (isso é `memory.ts`).

- **`calibrateRatio`** — sem tokenizer antes de enviar, cada estimativa é um chute; toda resposta devolve `prompt_eval_count` exato, e dividir chars enviados por ele dá a densidade real **desta** conversa. Cai para o default (`DEFAULT_CHARS_PER_TOKEN = 3.8`, medido nos docs do próprio projeto — 3,8 para prosa variada, até 5,1 para texto repetitivo) quando não há o que aprender.
- **`GATE_MARGIN = 0.9`** — a estimativa por caractere pode subcontar por ~1/3; um portão que disparasse exatamente no teto nominal dispararia depois do dano.
- **`REASONING_OUTPUT_RESERVE_RATIO = 0.35`** — fração da janela reservada para o que o modelo ainda vai **gerar** (resposta + raciocínio quando ligado). Ponto de partida medido ao vivo (uma sessão real com `qwen3.5:2b` mostrou raciocínio várias vezes mais longo que a resposta final), não uma constante definitiva — ajustar depois de mais teste ao vivo com raciocínio ligado.
- **`DEFAULT_NUM_CTX = 32768`** — substitui os 4096 do Ollama quando a conversa não escolheu janela (D15.2): reservar janela é barato, **preenchê-la não é** — o teto declarado do `gemma3:4b` (131072) seriam ~87 minutos de prefill nesta CPU.
- **`CONTEXT_BANDS = [4096, 8192, 16384, 32768, 65536, 131072, 262144]`** — as sete faixas fixas do controle (21-C-C), substituindo o slider contínuo. O domínio de baixo nível continua sendo o **token bruto**, nunca um índice nesta lista: uma conversa travada num valor fora das faixas (de antes deste controle existir) continua mostrando o valor real, sem forçar encaixe.

### `ConversationWindow` — os quatro estados, e por que o quarto existe

```ts
type ConversationWindow =
  | { status: 'open'; numCtx: number }        // nada enviado ainda, livre para mudar
  | { status: 'locked'; numCtx: number }      // travado no 1º envio (D15.13), ainda cabe
  | { status: 'too-large' }                   // o modelo não cabe nesta máquina
  | { status: 'unaffordable'; numCtx: number } // travado, e esta máquina não aguenta mais
```

O par `(modelo, num_ctx)` trava no **primeiro envio** — antes disso a janela deriva livremente do que cabe agora. `'unaffordable'` é o modo de falha assimétrico da trava: a reserva é refeita a cada carregamento e a RAM livre varia ~3 GB nesta máquina, então uma janela travada enquanto ociosa pode não alocar depois — **recusar é o ponto**, porque encolher em silêncio é exatamente o que a trava existe para não fazer.

⚠️ **`costed` distingue reserva real de orçamento client-side.** Para Ollama, `num_ctx` é uma reserva de RAM local de verdade, compartilhada entre prompt e geração (por isso `REASONING_OUTPUT_RESERVE_RATIO` só se aplica quando `costed`). Para nuvem, `num_ctx` **nunca chega ao corpo da requisição** — é só contabilidade do lado do cliente — então reservar espaço de geração contra ele não tem sentido, e `conversationWindow` sempre re-deriva em vez de travar, mesmo para uma conversa já travada num valor antigo de antes de este parâmetro existir.

### Ancoramento pós-fato (21-C-A) — por que o medidor não reprocessa a história inteira a cada render

`budgetFor` aceita um `anchor?: { tokens: number; chars: number }` — o último `promptTokens` real e os chars que o produziram. Presente, `charsPerToken` só estima o que mudou **desde** esse ponto; ausente, cai no comportamento antigo (linear sobre a história inteira). `anchorFromHistory(messages)` reidrata isso ao reabrir uma conversa ou relançar o app, andando de trás para frente até a última mensagem do assistente com `promptTokens` real — sem isso, reabrir uma conversa reintroduzia o mesmo drift "N+1 não acumula" que o ancoramento existe para consertar.

⚠️ **O anchor fica obsoleto quando `removeMessage` encolhe a história abaixo do ponto ancorado** — `budgetFor` detecta isso (`anchor.chars > historyChars`) e cai de volta no fallback de história inteira; sem essa guarda a estimativa congelaria no `anchor.tokens` velho e podia recusar um envio que na verdade cabe.

## Motivo de parada — `'context-exhausted'`, e como cada provedor sinaliza

Além de `'cancelled'`/`'timeout'` (do lado do app), existe `MessageStopped: 'context-exhausted'` (21-C-B) — a janela encheu antes do modelo terminar de gerar. Os três adaptadores já parseiam o campo nativo e hoje o traduzem:

| Provedor | Campo nativo | Valor que sinaliza |
|---|---|---|
| Ollama | `done_reason` (`OllamaChatLine`) | `'length'` |
| Gemini | `finishReason` (`GeminiChunk.candidates[0]`) | `'MAX_TOKENS'` |
| GLM | `finish_reason` (`GlmChunk.choices[0]`) | `'length'` |

⚠️ **Sondado ao vivo contra o Ollama real antes de confiar no campo** (`qwen3:4b`, `think: true`, `num_ctx: 256`): o modelo gerou bem mais do que 256 tokens comportariam, mas a linha final chegou limpa com `done_reason: 'length'` — refutou a hipótese (levantada pelo advisor) de *context shifting* silencioso no llama.cpp. Não presuma o comportamento de um campo nativo sem sondar; documente a sonda, não só o resultado.

## Capacidades: de onde vêm, e a armadilha que já mordeu uma vez

`src/core/ai/models.ts` normaliza o catálogo. Duas armadilhas reais, cada uma já causou um bug:

⚠️ **Capacidade vem de `/api/show`, nunca de `/api/tags`.** `/api/tags` omite `vision` por completo (`gemma3:4b` é `["completion"]` ali, `["completion","vision"]` em `/api/show`) enquanto relata `tools` nos dois — um gate construído sobre `tags` recusaria o único modelo desta máquina que enxerga. É por isso que `ollamaModels` faz N+1 requisições (`/api/tags` uma vez, `/api/show` por modelo) em vez de confiar só no primeiro.

⚠️ **`readInfo` lê por caminho **abaixo do prefixo de família**, nunca reconstruído do nome do modelo, e tem que remover exatamente **um** segmento — não casar por sufixo.** `mistral:7b` responde sob `llama.context_length`, não `mistral.context_length` — o prefixo de família diverge do nome do modelo. E um modelo com visão carrega um `gemma3.vision.block_count` paralelo que também termina em `.block_count`; casar por sufixo pegaria o campo errado (D15.8). É o caso que a skill `testing` cita como "teste vacuoso": um teste de "modelo com visão" passava contra a implementação **errada** (buscar por sufixo) só porque o Ollama calhava de devolver as chaves numa ordem favorável.

**`exposesReasoning(model)` ≠ `hasCapability(model, 'thinking')`.** A primeira pergunta é "este app consegue **mostrar** o raciocínio deste modelo agora"; a segunda é "o modelo pensa". Gemini pensa (`capabilities` inclui `thinking`, `thinkingLevel` não tem desligar de verdade, D21A.6) mas `generateContent`/`streamGenerateContent` não tem bloco de pensamento dedicado — confirmado contra a documentação da Interactions API (21-C-C) — então `exposesReasoning` retorna falso especificamente para Gemini, sem mexer em `capabilities`.

`GLM_MODELS`/`GEMINI_MODELS` são catálogos **fixos**, escritos à mão (não há `/api/show` para nuvem) — `sizeBytes: 0`/`attention: null` são valores verdadeiros, não placeholders: o modelo não custa RAM local, e `contextCeiling`/`fitsInMemory` já tratam `attention: null` como "não custeável".

`dropRedundantVariants` descarta um modelo cujo `parent_model` (`ollama create`) também está instalado — um clone feito para um app irmão (mill.tools) compartilhando o mesmo Ollama, não uma segunda instalação; mantém o variante quando o pai está ausente, porque aí é o único jeito restante de rodar aqueles pesos.

## Três provedores, um contrato — streaming, raciocínio e erro

Os três adaptadores implementam o mesmo `ChatFn`, mas o formato de fio diverge; a tabela é o que muda ao adicionar um quarto provedor:

| | Ollama | Gemini | GLM |
|---|---|---|---|
| Transporte | NDJSON (`stream: true`), um objeto por linha | SSE (`?alt=sse`), `data: {...}` por linha | SSE, `data: {...}` até `data: [DONE]` |
| Papel de sistema | `role: 'system'` dentro de `messages` | `systemInstruction` **fora** de `contents`; sem `role: 'system'` interno | `role: 'system'` (OpenAI-compatible) |
| Papel do assistente | `'assistant'` | `'model'` | `'assistant'` |
| Sinal de "pensar" | `think: onThinking !== undefined` | `includeThoughts: true` dentro de `thinkingConfig` | `thinking: { type: 'enabled' \| 'disabled' }` |
| Raciocínio no fio | campo irmão `message.thinking`, antes de `message.content` — nunca no mesmo campo | mesmo array `parts`, distinguido por `part.thought === true` | campo irmão `delta.reasoning_content` |
| Disponibilidade | ping real (`/api/version`) | "há chave guardada", nunca um ping de verdade | idem Gemini |
| Autenticação | nenhuma (localhost) | header `x-goog-api-key` | header `authorization: Bearer` |

⚠️ **D21A.1 — a presença de `onThinking`, não um booleano paralelo, é o sinal que liga o raciocínio no provedor.** Os três adaptadores leem `onThinking !== undefined` para decidir `think`/`includeThoughts`/`thinking.type`; passar `onThinking: undefined` explicitamente e uma flag `wantsReasoning: true` separada divergiria em silêncio se alguém esquecesse de sincronizar as duas.

⚠️ **Gemini: `part.thought` e o texto de resposta compartilham o mesmo array `parts`** (D21A.6) — é preciso filtrar por `thought === true` **antes** de juntar, ou o texto de raciocínio entra em `content` sem nenhum erro para sinalizar. **`includeThoughts` é mandado mas nenhuma resposta real trouxe `part.thought` de volta ainda, causa não estabelecida (D21A.10)** — Gemini degrada graciosamente (o app não quebra), mas não confie que o campo chega; a Interactions API (21-C-C, não implementada) é o caminho documentado para raciocínio real do Gemini.

⚠️ **`thinkingLevel` do Gemini não tem "desligado" de verdade** (D21A.6) — fixo em `'low'`, o mínimo confirmado válido para os dois modelos do catálogo (`'minimal'` falha com HTTP 400 em `gemini-3.7-flash`, medido ao vivo). Trocar o nível por modelo exige checar o enum válido daquele modelo específico antes de generalizar.

⚠️ **`404-ish/socket split` — todo parser de linha (NDJSON ou SSE) carrega o resto de uma linha partida em `buffer` até a próxima quebra chegar.** Um `JSON.parse` direto sobre o chunk bruto do socket falha de forma intermitente, só sob certas velocidades de rede — os três parsers seguem essa mesma disciplina, não é incidental.

**127.0.0.1, nunca `localhost`, para o Ollama** — pula a resolução DNS e evita a corrida IPv4/IPv6 que deixa `localhost` intermitentemente lento no Windows.

## Erro upstream: um formato, três corpos de resposta

`src/core/ai/upstreamError.ts` — `describeUpstreamError(status, body)` segue as classes de status do RFC 9110: 401/403/429 ganham dica específica (a correção é a mesma não importa o corpo); os demais 4xx/5xx preferem a mensagem do próprio corpo do provedor, caindo para uma mensagem de classe que ainda nomeia o status. Cobre as duas formas reais: `{"error": "..."}` (Ollama) e `{"error": {"message": "..."}}` (GLM/OpenAI-compatible) — provider-agnostic, então um quarto provedor com uma terceira forma cai no fallback de classe, não quebra.

`UpstreamError` (`core/ai/types.ts`) carrega `status: number | null` — `null` é um erro **dentro** do stream, HTTP 200 mas `{ error }` no corpo (visto nos três adaptadores). `mapProviderError` (`handlers.ts`) é o único lugar que decide `AppError.upstream` vs `AppError.unavailable`: um `fetch` que rejeita com `TypeError` (ECONNREFUSED, DNS) tem o mesmo significado de um probe que falhou.

Três timeouts distintos, cada um medido: `PING_TIMEOUT_MS = 10s` (disponibilidade — sem ele o cartão de status trava minutos com o serviço fora do ar); `CHAT_TIMEOUT_MS = 1.000.000 ms` (16,7 min — `gemma3:4b` carrega a frio em ~48s e prefila a ~23 tok/s nesta CPU; um documento de 14 KB sozinho já usava 240s do orçamento antigo de 300s); `CATALOG_TIMEOUT_MS = 60s` (o catálogo é N+1 requisições, nunca roda inferência, então minutos só significariam serviço travado).

## "Disponível" na nuvem significa "há chave guardada", nunca um ping de verdade

`makeGlmProbe`/`makeGeminiProbe` (mesma forma) checam `hasKey()` — reaproveita `hasSecret` (N-1-A), barato, sem decrypt — e nunca gastam uma chamada real só para responder um cartão de status. `src/core/ai/secrets.ts` classifica o que `safeStorage` promete de fato: `assessSecretBackend` distingue `'ok'` de `'weak'` (Linux `basic_text` — o fallback do próprio Electron para "nenhum cofre de segredo encontrado, criptografando com senha fixa no binário", que ainda reporta `encryptionAvailable: true`) de `'unavailable'` (bloqueia a escrita). `weakBackend: true` viaja como **sucesso** de `secrets:write`, nunca como `AppError` — só `'unavailable'` bloqueia.

## Mensagens: da UI ao provedor, e o limite de privacidade

`src/core/ai/messages.ts` — `Message` é lista de partes tipadas; um provedor quer `{ role, content }` plano. A tradução mora em `core/`, não no renderer, porque a fronteira de privacidade de três níveis (esquema · perfil agregado · amostra de linhas, dono `ESCOPO.md`) é decisão que dois chamadores (renderer e handler) precisariam concordar — validação colocada ao lado de um vira bypass no outro.

- **`partForProvider`** é o único lugar que materializa uma parte não-textual: `dataset` → `formatDataCard` (nome + colunas + contagem de linhas — **nunca** uma linha, level 1); `document` → `formatDocumentCard` (extração verbatim); `image` → string vazia (a imagem viaja em `ChatMessage.images`, campo próprio do fio do provedor, D17.5); `stepProposal` → reenviada como texto a cada turno (provedor stateless, o modelo perde o que já propôs se não for); `reasoning` → **nunca reenviada** (D21A.3) — o conteúdo final já captura o que importa, reenviar só infla `historyChars` à toa.
- **`toChatMessagesWithImages`** é assíncrono e roda **só no main** — um renderer sandboxed não tem `fs` para ler `userData/attachments/<hash>`; `resolveImageBytes` é injetado, mesmo DIP do `createHashedLines` do `attachDataset`.
- **`imageCountOf`** alimenta o termo plano de `budget.ts` (`IMAGE_TOKEN_ESTIMATE = 270`, medido no `gemma3:4b`, único modelo com `vision` na frota) — não proporcional a nada que o app manda, por isso soma como termo fixo em vez de entrar na razão de caracteres.

`formatColumnProfile` (`proposal.ts`) nunca inclui `topValues` — só `type`/`nullPercentage` — porque os valores mais frequentes de uma coluna **são** conteúdo de célula, exatamente o que a fronteira esquema-apenas existe para barrar.

## Proposta NL→passo

`src/core/ai/proposal.ts` + `chat.ts`: `requestStepProposal` monta as mensagens (instrução fixa em português, cartão de dados, perfil opcional, o pedido) e chama `runStructuredChat`, que roda com `format` (JSON Schema que restringe a decodificação, D19.3) em vez de `onChunk` — uma resposta restrita a schema não se consome útil token a token (D19.5). A resposta é `JSON.parse`ada e então `schema.parse()`ada; falhar qualquer um dos dois passos devolve `invalidProposal` — **nunca lança**: um modelo produzindo saída estruturada malformada é falha esperada que o chamador trata, não bug.

## Onde a lógica mora, e como se testa

`core/ai/` é puro — nível 1, sem Electron, sem rede real (a fronteira `ChatFn`/`ProbeFn`/etc. é o seam injetado). `main/features/ai/handlers.ts` é nível 3 (função exportada, dependências por parâmetro, skill `testing`). Os três adaptadores em `main/features/ai/providers/` têm teste próprio contra fixtures de linha de fio (NDJSON/SSE), não contra o serviço real — a sonda ao vivo (como a do motivo de parada, acima) é verificação separada, feita uma vez e documentada, não repetida a cada `pnpm test`.

⚠️ **Um teste "não escreve `numCtx` quando não há janela" passava porque o campo nem é renderizado nesse estado** — o código antigo também passaria (caso real, skill `testing`). Ao testar orçamento/janela, prove o **estado final** que o defeito inverteria, não a ausência de uma chamada.
