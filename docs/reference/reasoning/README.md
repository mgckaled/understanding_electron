# Raciocínio visível — guia de implementação (arco 21)

> 01/09/2026. Motivado pelo início da sessão do arco 21: o `web-fetch_mcp_thinking.md` (ago/2026) propunha a "Feature 3 — Thinking Mode" com pouca profundidade (uma seção genérica, sem ler os três adaptadores reais nem as APIs primárias). Este documento a substitui como fonte para o arco 21 especificamente — as Features 1/2 daquele guia (busca web, MCP) continuam vivas para os arcos 22/23. Como todo documento deste gênero: **levantamento prévio, não o plano em si.** Marca cada item como decidido, questão em aberto ou risco a validar ao vivo — não substitui a leitura do plano que vier a nascer.
>
> ⚠️ **Auditado no R-6 (03/09/2026): parcialmente consumido, não o documento inteiro.** As seções sobre 21-A/21-B (contrato IPC do raciocínio, o rename `ThinkingMark`→`RespondingMark`, a prova de que persistir não migra o banco) descrevem trabalho já implementado — a regra viva que sobrou está na skill [`ai`](../../../.claude/skills/ai/SKILL.md) e a narrativa em [`HISTORY.md`](../../HISTORY.md)/nos planos `implemented/21-A`/`21-B`. **A seção "A Interactions API" continua viva de propósito** — é o desenho da migração do `gemini.ts` ainda **não** implementada (`ROADMAP § 2`, "plano futuro, ainda sem número"); marcar o documento inteiro `⛔ consumido` enterraria a única referência que essa migração futura vai precisar. Estado permanece `✅ vivo`, escopo reduzido.

## Por que este documento existe em vez de `plan/active/21-A.md`

`ROADMAP.md § 1` já registra a regra para os planos 21–23: nascem como arquivo **na sessão em que forem o próximo a ser executado, nunca antes**. Esta sessão fez o levantamento mas não tem garantia de chegar à implementação completa de todos os cortes — o registro precisa sobreviver entre sessões sem violar essa regra, daí `reference/` em vez de `plan/active/`.

## Estado atual do código (confirmado lendo os três adaptadores, 01/09/2026)

Os três já têm o mesmo *stopgap*, cada um citando "planos 21-23" no comentário:

| Adaptador | Linha | O que está travado |
|---|---|---|
| [`src/main/features/ai/providers/ollama.ts`](../../../src/main/features/ai/providers/ollama.ts) | 194 | `think: false` fixo — `message.thinking` nunca é lido |
| [`src/main/features/ai/providers/glm.ts`](../../../src/main/features/ai/providers/glm.ts) | 46 | `thinking: { type: 'disabled' }` — `delta.reasoning_content` nunca é lido |
| [`src/main/features/ai/providers/gemini.ts`](../../../src/main/features/ai/providers/gemini.ts) | 88 | `thinkingConfig: { thinkingLevel: 'low' }` sem `includeThoughts` — o modelo já pensa (não há "desligar" real nesta família), só não expõe o resumo |

O resto da tubulação já existe e não precisa nascer: `GLM_MODELS`/`GEMINI_MODELS` (`core/ai/models.ts`) e o `/api/show` do Ollama já declaram `capabilities: [...,'thinking']`; `capabilities.ts` do renderer já rotula a sigla `TH` como "Raciocínio — cadeia de pensamento explícita"; `Composer.tsx` já tem o padrão de gate por capacidade (`hasCapability(model, 'vision')` → `visionBlocked`, D17.11) a copiar para `thinking`.

⚠️ **O toggle da UI já existe — não é código novo, é uma linha reservada e desligada.** `AttachButton.tsx:19-23` já declara o array `TOOLS` espelhando `ESCOPO.md § Ferramentas do chat`, com os três rótulos exatos do produto (`Busca web`, `Raciocínio visível`, `Documentação (MCP)`), e `:207-218` já renderiza a seção "Ferramentas" do popover de anexo com um `Switch` por linha — hoje `checked={false} onChange={() => {}} disabled` para as três, incondicional. O comentário no topo do array (F2.6) já registra a regra: **"each future plan only flips `disabled` and wires a real `onChange`, never redesigns the row."** Para o arco 21, isso significa: a linha "Raciocínio visível" ganha `disabled={!hasCapability(model, 'thinking')}` e `onChange` real; as outras duas (Busca web, Documentação/MCP) continuam `disabled` — são dos arcos 22/23, fora de escopo aqui. Fica em aberto, para o 21-A resolver, onde mora o booleano `checked` (estado local do `Composer`, ao lado de `attachment`, ou algo persistido em `conversation.settings` — o toggle é "alternável por turno", o que sugere estado local, não coluna).

## As três APIs — o que cada uma exige, com fonte primária

| | Campo do stream | Config de entrada | Fonte |
|---|---|---|---|
| **Ollama** | `message.thinking` — campo **irmão** de `message.content`, intercalado ANTES dele no NDJSON | `think: true\|false` (booleano cobre o `qwen3:4b`; modelos GPT-OSS exigiriam nível `low/medium/high/max`, não é o caso aqui) | [docs.ollama.com/capabilities/thinking](https://docs.ollama.com/capabilities/thinking) |
| **GLM/Z.ai** | `delta.reasoning_content` — campo **irmão** de `delta.content`, mesma disciplina do NDJSON já implementada | `thinking: { type: 'enabled' \| 'disabled' }`; opcional `reasoning_effort: 'low'\|'high'\|'max'` | Context7 (`/websites/z_ai`), doc primária `docs.z.ai/guides/capabilities/thinking` |
| **Gemini** | `{ text, thought: true }` — **dentro do MESMO array `parts`** que o texto final, não é campo irmão | `generationConfig.thinkingConfig: { thinkingLevel, includeThoughts: true }` | ai.google.dev/gemini-api/docs/generate-content/thinking |

⚠️ **Confirmado especificamente para o caso deste app (texto puro, sem tool calling, histórico completo reenviado a cada turno — stateless):** `thoughtSignature` **não é exigido** nesse regime. A doc do Gemini só o torna obrigatório quando a requisição inclui `function calling`/`function declarations` — que este app não usa nos adaptadores de chat.

## Três achados que mudam o desenho, não só o detalhe

### 1. O parser do Gemini corrompe a resposta se o toggle ligar sem ajuste — bloqueia, não é polimento

`gemini.ts` hoje faz:

```ts
const piece = chunk.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
```

Sem filtrar por `part.thought`. Ligar `includeThoughts: true` sem separar por esse campo faz o texto de raciocínio ser **concatenado dentro do conteúdo final** — sintoma é resposta com o raciocínio colado no início, sem nenhum erro lançado. O tipo `GeminiChunk` também precisa ganhar o campo `thought?: boolean` em cada parte. Ollama e GLM não têm esse risco — são campo irmão, imunes por construção.

### 2. Confirmado ao vivo no 21-A: `streamGenerateContent` não devolveu `thought`, 2/2 — causa não estabelecida

Verificação ao vivo, 02/09/2026, 2/2: nem `gemini-3.5-flash-lite` nem `gemini-3.7-flash` devolveram um único `part.thought`, com `includeThoughts: true` enviado nos dois. **A evidência não prova "nunca funcionou":** o próprio adaptador tem um HTTP 400 medido ao vivo em N-1-C para `thinkingLevel: 'minimal'`, prova de que o endpoint validava esse campo de verdade em algum momento. O que se sabe, com a força certa de cada fonte: a documentação atual do Google (`ai.google.dev/gemini-api/docs/thinking-mode`) hoje só mostra exemplo de raciocínio visível pela **Interactions API** (`client.interactions.create`) — é ênfase de rota recomendada pelos autores da doc, não uma afirmação de que o campo antigo foi removido; a única frase textual que se tem ("the generateContent API does not provide dedicated thought blocks, instead attaching signatures as metadata") fala de **assinaturas opacas** (contexto de function calling), não do texto do resumo de raciocínio em si — usá-la para concluir sobre o resumo é ler além do que ela diz. Relatos externos desde jan/2025 ([`discuss.ai.google.dev`](https://discuss.ai.google.dev/t/thoughts-are-missing-cot-not-included-anymore/63653), issue no [`litellm`](https://github.com/BerriAI/litellm/issues/15779)) descrevem `streamGenerateContent` parando de devolver `thought` em modelos **2.x** — compatível tanto com "quebrado e nunca corrigido" quanto com "removido de propósito", e datado, não sobre os modelos 3.x deste app. **Conclusão honesta:** confirmado 2/2 nesta conta com os dois modelos do catálogo, causa a esclarecer — não uma prova de que o endpoint nunca teria funcionado.

**Não bloqueia o 21-A** — o caminho Ollama e o GLM provam o mecanismo de ponta a ponta, cada um pelo seu campo irmão. Decisão registrada (D21A.10): o Gemini degrada graciosamente (manda `includeThoughts`, não quebra quando nada volta) e a migração para a Interactions API vira gatilho do `ROADMAP § 2`, condicionada a confirmar se `store: false` preserva o modelo stateless que D21A.6 assumiu impossível com essa API.

## A Interactions API — confirmada no 21-C-C, causa fechada

O que o 21-A deixou como "causa não estabelecida" (§ acima) tem resposta: pesquisa via Context7 (`/googleapis/python-genai`) e a própria documentação oficial da Interactions API (`ai.google.dev/gemini-api/docs/interactions/thinking`) afirmam, textualmente, que `generateContent`/`streamGenerateContent` **não tem bloco de pensamento dedicado nenhum** — "the Interactions API provides thoughts as a first-class representation as dedicated `thought` steps", em contraste direto com o endpoint que `gemini.ts` usa. Não é bug, não é parâmetro faltando: é a forma de resposta do endpoint, por desenho.

A Interactions API expõe raciocínio de verdade, para os **mesmos** dois modelos do catálogo (`gemini-3.5-flash-lite`, `gemini-3.7-flash`), com um contrato diferente:

- Configuração: `generation_config.thinking_summaries: "auto"` — não `thinkingConfig.includeThoughts`, que nem existe nesse contrato.
- Resposta: `steps[]`, cada `thought` step com `signature` (obrigatória) e `summary` (texto, opcional — pode vir vazio se o modelo não raciocinou o bastante).
- Streaming: suportado (`stream=true`, SSE, eventos `step.delta`).

**A pergunta que travava a migração desde o D21A.6 está respondida.** `store: false` preserva o modelo stateless full-history-resend que os outros dois adaptadores já usam: o cliente mantém o array de `steps` e reenvia o histórico acumulado a cada turno, igual ao que `ollama.ts`/`glm.ts` já fazem — só que em modo stateless, a `signature` de cada `thought` step anterior precisa ser reenviada junto, intacta, o que **engorda `historyChars`** e cruza direto com o orçamento de contexto sob raciocínio (21-C-A).

**Implementado em [`21-D-A`](../../plan/active/21-D-A-interactions-api-o-parser-novo.md), 04/09/2026.** `gemini.ts` fala com `POST /v1beta/interactions` (`store: false`, `stream: true`), corpo em `snake_case`, `system_instruction` como string solta (não `{parts:[...]}`), `input` como lista plana de `{type: 'user_input'|'model_output', content: [...]}`. O parser lê `data: {...}` linha a linha e despacha pelo campo `event_type` do próprio JSON (não por uma linha SSE `event:` separada — confirmado como convenção mais robusta, `StepDelta.event_type` no schema do `python-genai`): `step.start` anuncia um step por `index`, `step.delta` incrementa; um `thought` step só é considerado fechado ao fim do stream, e sua `signature` só conta se algum evento a preencheu antes disso (nunca no `step.start`, onde chega vazia).

**Guarda de contrato em dois graus (D21D.3), não um.** Grau 1 — step de tipo desconhecido (`function_call`, `file_search_call`, `code_execution_call`, ou o que a Google acrescentar): loga e ignora, o turno segue. Grau 2 — falta estrutural (nenhum `steps`, nenhum `model_output` num turno completo, `thought` fechado sem `signature`): `UpstreamError` nomeada, mesmo caminho de `AppError.upstream` que já existia. Motivo de parada (D21D.1): `status: 'incomplete'` → `'context-exhausted'`; `status: 'budget_exceeded'` → erro upstream próprio, nunca colapsado no mesmo rótulo — **nenhum dos dois confirmado ao vivo ainda**, ver "Verificação ao vivo" do plano.

**Fora de escopo aqui, por desenho:** `exposesReasoning()` continua excluindo Gemini (D21D.4) — o parser já extrai `reasoning`, mas nada persiste a `signature` nem a reenvia ainda; isso é o [`21-D-B`](../../plan/active/21-D-B-signature-resend-e-orcamento.md), que só começa depois deste fechar.

### 3. "Alternável por turno" significa três coisas diferentes — decide o rótulo da UI

| | O que o toggle controla de fato |
|---|---|
| Ollama | liga/desliga o raciocínio de verdade (`think`) |
| GLM | liga/desliga de verdade (`thinking.type`) + `reasoning_effort` opcional |
| Gemini | **só se o resumo volta visível** (`includeThoughts`) — `thinkingLevel` tem piso `'low'`, não existe "desligar" nesta família |

Consequência de produto: o rótulo honesto na UI é **"mostrar raciocínio"**, não "pensar mais" — do contrário o app promete no Gemini um efeito que ele não entrega. Com o toggle desligado no Gemini, o mínimo é manter `thinkingLevel: 'low'` e só omitir `includeThoughts` — comportamento idêntico ao de hoje, zero regressão.

## Colisão de nome — decidida, e na direção oposta à primeira leitura

Leitura inicial errada: "nascer o vocabulário novo como `reasoning` para não colidir com `thinking`". **Invertido ao olhar o próprio componente:** `ThinkingMark.tsx:86` já renderiza o texto **"respondendo…"**, e seu `aria-label` (linha 67) já é `'Gerando resposta'` — o nome `Thinking*` é que está errado desde o F-1, não o vocabulário do arco 21. O conserto é renomear o que já existe, não desviar o que vai nascer:

| Símbolo hoje | Renomeia para |
|---|---|
| `ThinkingMark.tsx` | `RespondingMark.tsx` |
| `useThinkingLoop.ts` | `useRespondingLoop.ts` |
| `--thinking-*`, `--duration-thinking-cycle` (`tokens.css:114-124`) | `--responding-*`, `--duration-responding-cycle` |
| `.thinking-dot`, `.animate-thinking-dot` (`tailwind.css:101-143`) | `.responding-dot`, `.animate-responding-dot` |

Cinco sítios mecânicos (os quatro arquivos acima + `ConversationView.tsx:23,256` + `ThinkingMark.test.tsx`) — rename barato, mas **não** confirmável só por `pnpm check:fast`: `--thinking-*` e `.thinking-dot`/`.animate-thinking-dot` são token e `@utility` do Tailwind, e pela skill `design-system` o único juiz de que uma utilidade gera CSS de verdade é o **CSS construído**, não o fonte (precedente: `accent-accent` do F-3-F, que compilava e não gerava regra nenhuma). Conferência visual ao vivo depois do rename, obrigatória.

Isso libera `reasoning`/`Raciocínio` por inteiro para o arco 21, sem inventar nada para escapar da colisão — é exatamente o vocabulário que `capabilities.ts` já usa para a sigla `TH`.

**Separado do rename, e não consequência automática dele:** a ideia de isolar o monograma. Hoje `<ThinkingMark isStreaming={...} />` (`ConversationView.tsx:256`) é sua própria banda de largura total entre a rolagem da conversa e o composer (`className="flex-none bg-bg px-7 py-5"` — `flex-none` só trava o *flex-shrink*, a banda ainda estica na largura do pai). O monograma (os 14 pontos que formam o "C") é **insubstituível** — segue existindo; o que muda é ele **não ocupar mais a banda inteira**, para o bloco recolhível de raciocínio (21-B) ter onde nascer na mesma região sem disputar espaço. Isso é decisão de layout a favor do alvo do DS, não um efeito colateral do rename — trata os dois como itens separados no plano.

## A pergunta que dimensiona o arco inteiro — RESOLVIDA (e ao contrário da pergunta original)

**Pergunta do usuário: "raciocínio persiste, logo precisa de migração no `crivo.db`, certo?" — Não, se modelado como `MessagePart`.**

O comentário da própria `v1` em `migrations.ts:10-14` já registra o teste que decide isso: *"`parts` é JSON so the plano-16/17 MessagePart variants cost none; `stopped` is a column, not content, so the interface need not open the JSON to draw a label."* — ou seja, o critério é **"algo precisa ser lido sem desserializar `parts`?"**. Para dataset/documento/imagem/`stepProposal`, não precisa — e nasceram como variante de `MessagePart`, migração zero. Raciocínio só é lido quando a mensagem já está sendo renderizada (o mesmo caso), então uma quinta variante —

```ts
export const reasoningPartSchema = z.object({ kind: z.literal('reasoning'), text: z.string() })
```

— em `messagePartSchema` (`shared/ipc.ts:591-597`) persiste **sem** tocar `migrations.ts`. **Persistir e migrar o banco não são a mesma coisa neste projeto** — é a distinção que este arco esbarra de propósito.

⚠️ **O que isso não resolve sozinho, e que reintroduziria o custo por outra porta:** uma vez que raciocínio é uma `MessagePart`, ele passa por `partForProvider` (`core/ai/messages.ts:78`) no turno seguinte — o mesmo `switch` exaustivo sobre `part.kind` que hoje serializa `text`/`stepProposal` e devolve `''` para `image` (D17.5: bytes vão por canal próprio, não por texto). O `case 'reasoning':` que o TypeScript vai exigir ali **é uma decisão de produto, não só de tipo**: devolver o texto reenvia o raciocínio do turno anterior ao provedor a cada turno seguinte (stateless, histórico inteiro reenviado), inflando `historyChars` e o orçamento que o `Composer` calcula, sem ganho claro — o conteúdo final já captura o que importa. **Recomendação a registrar no plano, não decisão tomada aqui:** `''`, mesmo tratamento do `image`. É item do 21-A (o `switch` já existe e o TypeScript recusa compilar sem o case), não descoberta para a sessão de implementação achar sozinha.

## Interação com o Observatório — agora **O-9**, não 21-C

Concordo com a correção: o corte que separa (ou documenta a mistura de) decode de raciocínio e decode de resposta pertence à numeração da trilha **O**, não ao arco 21. `ROADMAP.md § 1` registra que a trilha é "gatilhada, não sequencial" e que "O-1..O-8 concluídos... a trilha completa os oito cortes previstos na fundamentação" — essa frase **continua verdadeira**: os oito da fundamentação estão feitos, e o mecanismo da trilha (novo painel entra na fila quando o que ele observa passa a existir) segue aberto por desenho a um gatilho que a fundamentação não previu especificamente. Ligar raciocínio é esse gatilho.

O que motiva o painel, atualizado após a implementação do 21-A: `measureChatTiming` (`src/main/observatory/chatTiming.ts`) marca `t1` **só no primeiro `onChunk` de conteúdo** — decisão já tomada em 21-A, não pendência (`onThinking` não move `t1`). `decodeMs = t2 - t1` portanto **exclui** a fase de raciocínio quando o toggle está ligado.

- `evalTokens` (`eval_count` do Ollama) quase certamente conta **todos** os tokens gerados, raciocínio incluso — não é comparável ao `decodeMs`, que só cobre conteúdo;
- a consequência não é "misturar dois decodes indistinguíveis": é que o numerador (`evalTokens`) fica inflado em relação ao denominador (`decodeMs`), então a taxa de tokens/s que o O-7 mostra **lê mais rápida do que o decode de conteúdo real** enquanto o toggle está ligado — um viés sistemático numa direção, não ruído.

**Não bloqueia 21-A/21-B.** Quando a numeração ganhar arquivo (`O-9`, não antes — mesma regra de nascimento tardio dos planos 21-23), dois documentos precisam de uma linha cada: `ROADMAP.md § 1` (a linha da trilha O deixa de dizer só "oito cortes") e `docs/reference/observatory/README.md` (o inventário que fundamenta cada painel `O-n`). Registrado aqui como pendência de auto-conservação, não feito agora — os dois documentos continuam factualmente corretos até o dia em que O-9 existir.

## Proposta de cortes — dois arquivos quando existirem (B encolheu), nunca um com passos

Precedente já validado no plano 19 (feedback do usuário): sessões curtas viram arquivo próprio, não passo dentro de um arquivo maior.

**A fronteira entre A e B é "mostra" vs. "mostra bem".** Confirmado pelo usuário: 21-A precisa provar o caminho inteiro de ponta a ponta — inclusive alguma exibição em tela — mas **sem** investir no design; 21-B é onde o bloco recolhível vira elegante. Uma coisa é responder, outra é pensar (`RespondingMark` continua sendo só o primeiro), e o app já promete a UX-alvo por escrito: a sugestão original do guia superado — "Bloco de thinking renderizado colapsado/recolhível acima da resposta final, com label tipo 'Raciocínio'" — é o que o 21-B precisa cumprir de verdade, com o cuidado de acabamento que o resto do app já tem (padrão comum em ferramentas de chat com modelos de reasoning).

- **21-A — o dado atravessa, o nome se resolve, e a UI existe (sem ser bonita ainda).** ✅ Concluído em 02/09/2026 — [`plan/implemented/21-A-o-raciocinio-atravessa.md`](../../plan/implemented/21-A-o-raciocinio-atravessa.md). O rename `Thinking*` → `Responding*`, `ChatFn.onThinking?`, `reasoning` como variante de `MessagePart`, os três adaptadores, e o toggle destravado — tudo como este guia previu, com o achado extra do Gemini (§ acima).
- **21-B — o dado aparece bem.** ✅ Concluído, verificado ao vivo — [`plan/implemented/21-B-o-raciocinio-aparece-bem.md`](../../plan/implemented/21-B-o-raciocinio-aparece-bem.md). Bloco recolhível (`ReasoningDisclosure`), rótulo por provedor, estado padrão colapsado/expandido durante o streaming (padrão de mercado confirmado ao vivo: Vercel AI SDK Elements "Reasoning" — abre durante streaming, recolhe ao terminar), prosa achatada sem markdown visível (achado adicional, fora do previsto aqui). Dois achados a mais que o levantamento original não previa: um ícone de lâmpada indicando "pensando" mesmo com o card fechado, e um bug real de uma armadilha já documentada (`h-0` não gera CSS neste projeto — ver `ARMADILHAS.md`).
- **21-C — orçamento sob raciocínio, faixas fixas, e o martelo do Gemini.** ✅ **Implementado e verificado ao vivo, os três sub-planos** — [`21-C-A`](../../plan/implemented/21-C-A-orcamento-de-geracao.md) (headroom de geração reservado, calibração por média móvel, ancoramento pós-fato — D21C.12/D21C.13: o medidor nunca exibia `promptTokens`/`evalTokens` reais, só a estimativa de caracteres), [`21-C-B`](../../plan/implemented/21-C-B-motivo-de-parada.md) (`context-exhausted`, sondagem ao vivo da API confirmou `done_reason:'length'`), [`21-C-C`](../../plan/implemented/21-C-C-faixas-fixas-de-contexto.md) (faixas fixas + campo numérico, `exposesReasoning` desliga o switch do Gemini, causa do D21A.10 fechada — § acima). ⚠️ **Registro corrigido na sessão do R-6:** a verificação ao vivo de 21-C-B/21-C-C já havia sido feita e validada pelo usuário na sessão original — o diário de cada plano nunca foi atualizado para refletir isso, e uma versão anterior deste parágrafo chegou a inferir (incorretamente) que faltava. Os três planos estão em `plan/implemented/`.
- **O-9 — Observatório**, condicional e fora da numeração do arco 21 (seção acima): só ganha arquivo se, ao chegar lá, o O-7 precisar mesmo separar as duas taxas de decode. Segue não aberto.

## Verificações já feitas nesta sessão, não repetir

- `qwen3:4b` segue instalado (`/api/tags`, 01/09/2026) — a frota ganhou também `qwen3.5:2b` desde a última medição do `CLAUDE.md`, sem checar ainda se declara `thinking`.
- Fonte primária do GLM confirmada via Context7 (`docs.z.ai`), não só resumo de busca — `reasoning_content`/`thinking.type` batem com o que o comentário do `glm.ts` já registrava.
- `measureChatTiming` lido por inteiro — a interação com O-7 acima é sobre o código real, não suposição.

## O que não tinha sido verificado ao escrever este guia — todos respondidos no 21-A

- Ao vivo: o `qwen3:4b` com `think: true` realmente intercala `message.thinking` antes de `message.content` neste binário do Ollama (0.32.14) — a doc descreve o comportamento, a medição de ago/2026 (`ARMADILHAS.md` § *`message.thinking` do Ollama é campo irmão*) só provou que o campo existe e é ignorado, não a ordem de chegada linha a linha.
- Ao vivo: se `gemini-3.5-flash-lite`/`gemini-3.7-flash` (os dois modelos do catálogo) de fato devolvem `part.thought` em streaming nesta conta — o achado #2 é risco documentado, não medição própria. **Respondido em 02/09/2026:** nenhum dos dois devolve, ver § *Confirmado ao vivo no 21-A*.
- Se `qwen3.5:2b` (instalado depois da última varredura de frota) declara `thinking` em `capabilities` — não impacta o desenho, só o inventário do `CLAUDE.md`/`reference/models/`.
