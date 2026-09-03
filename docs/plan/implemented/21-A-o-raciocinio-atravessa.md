# 21-A — O raciocínio atravessa

> Levantamento completo, riscos e fontes primárias: [`reference/reasoning/README.md`](../../reference/reasoning/README.md). Este plano não repete o racional — decide em cima dele. Se algo aqui divergir do guia, o guia é que está desatualizado; corrija-o na mesma sessão.

**Escopo do corte:** o dado de raciocínio atravessa as três camadas — provedor → contrato → persistência — e aparece em tela de forma mínima, sem o polimento do bloco recolhível. Uma coisa é responder, outra é pensar: por isso o corte também resolve a colisão de nome com o spinner "pensando" do F-1 antes de escrever qualquer código novo com o vocabulário `reasoning`. O bloco elegante, recolhível, é do **21-B** — não nasce aqui.

Local e nuvem na mesma leva (Ollama, GLM, Gemini) — confirmado pelo usuário, é a leitura correta do `ROADMAP.md § 1`.

---

## Decisões

### D21A.1 — A presença de `onThinking` é o sinal, não um booleano paralelo

`ChatFn` (`core/ai/types.ts`) ganha `onThinking?: (text: string) => void` nas opções, no mesmo nível de `onChunk`. Um adaptador só pede raciocínio ao provedor (`think: true`, `thinking: { type: 'enabled' }`, `includeThoughts: true`) quando `onThinking !== undefined` — mesmo padrão que `format` já usa para desviar `ollamaChat` para `requestStructuredChat`. Evita threading de um segundo flag redundante por toda a cadeia de chamadas.

### D21A.2 — `JobEvent` ganha uma variante, `job:event` não muda de forma

`{ jobId: JobId; type: 'reasoning'; text: string }` ao lado de `chunk`/`progress`/`log` em `shared/ipc.ts`. Uma linha — `job:event` não passa por `IpcContract`/`argsSchema` (mora em `shared/channels.ts`), então não há schema zod a tocar.

### D21A.3 — Raciocínio é `MessagePart`, não coluna — e não é reenviado ao provedor

`reasoningPartSchema = z.object({ kind: z.literal('reasoning'), text: z.string() })`, quinta variante de `messagePartSchema`. `parts` é JSON (`migrations.ts` v1, comentário) — **zero migração**. `partForProvider` (`core/ai/messages.ts`) ganha `case 'reasoning': return ''` — mesmo tratamento de `image` (D17.5): o conteúdo final já captura o que importa, reenviar infla `historyChars` sem ganho.

### D21A.4 — O nome errado é o que já existe, não o que vai nascer

`ThinkingMark`→`RespondingMark`, `useThinkingLoop`→`useRespondingLoop`, `--thinking-*`/`--duration-thinking-cycle`→`--responding-*`/`--duration-responding-cycle`, `.thinking-dot`/`.animate-thinking-dot`→`.responding-dot`/`.animate-responding-dot`, **e `@keyframes dotThinking` (`tailwind.css:117`, referenciado por `animate-thinking-dot:142`) → `dotResponding`** — achado tarde — o guia de referência tinha listado só os tokens e a `@utility`, e um rename que o deixasse para trás seria exatamente o tipo de metade-feito que a auto-conservação do `CLAUDE.md` existe para pegar. O componente já renderiza "respondendo…" (`ThinkingMark.tsx:86`) e já tem `aria-label="Gerando resposta"` — o rename alinha nome ao que a tela sempre disse, e libera `reasoning`/`Raciocínio` por inteiro. Feito **antes** de qualquer arquivo novo usar `reasoning`, para não haver janela com os dois vocabulários coexistindo.

### D21A.5 — O toggle destrava, não nasce

`AttachButton.tsx:19-23,207-218` já declara a linha "Raciocínio visível" (`TOOLS`), hoje `checked={false} onChange={() => {}} disabled` incondicional (F2.6). Ganha `disabled={!hasCapability(model, 'thinking')}` e `onChange`/`checked` reais. As outras duas linhas do mesmo array (`Busca web`, `Documentação (MCP)`) **não mudam** — arcos 22/23, e F2.6 continua proibindo redesenhar a linha.

### D21A.6 — Gemini precisa do filtro antes de ligar `includeThoughts`

`gemini.ts`'s `piece = parts?.map((p) => p.text ?? '').join('')` concatenaria raciocínio dentro da resposta final sem filtrar por `part.thought`. `GeminiChunk` ganha `thought?: boolean` por parte; o adaptador separa as duas listas antes de montar `piece`/`onThinking`.

### D21A.7 — `ai:propose` fica de fora

`requestStructuredChat` (`format` + `stream: false`) nunca recebe `onThinking` — raciocínio ali só atrasaria um corpo que vai direto para `.parse()`. Nenhuma mudança em `propose.ts`/`proposal.ts`.

### D21A.8 — Exibição em tela é mínima nesta sessão

Texto corrido, sem colapsar, sem rótulo por provedor — só prova que o dado chega de ponta a ponta. Vive na banda que o rename do D21A.4 libera (`ConversationView.tsx`, região do `RespondingMark`). O 21-B substitui isso pelo bloco recolhível elegante.

### D21A.9 — Default desligado, escolha do usuário por conversa

Mesmo argumento medido do `CHAT_TIMEOUT_MS`: prefill mais lento nesta CPU quando o modelo pensa. O app nunca liga sozinho — é o usuário quem decide, via o switch destravado (D21A.5).

### D21A.10 — Gemini degrada graciosamente: manda `includeThoughts`, mas hoje não recebe nada de volta

Confirmado ao vivo, 2/2 (`gemini-3.5-flash-lite` e `gemini-3.7-flash`): nenhum `part.thought` chega, em nenhum dos dois. **A causa não está estabelecida** — não é a leitura "nunca funcionou": o próprio comentário do adaptador registra um HTTP 400 medido ao vivo em N-1-C para `thinkingLevel: 'minimal'`, prova de que o endpoint em algum momento validava esse campo de verdade. O que se sabe: a documentação atual do Google (`ai.google.dev/gemini-api/docs/thinking-mode`, via Context7) hoje só mostra exemplo de raciocínio visível pela **Interactions API** (`client.interactions.create`) — indício de mudança de rota recomendada, não prova de remoção do campo antigo —, e relatos externos desde jan/2025 (`discuss.ai.google.dev`, issues no `litellm`/`python-genai`) descrevem `streamGenerateContent` parando de devolver `thought` em modelos 2.x, consistente tanto com "quebrado e nunca corrigido" quanto com "removido". **Decisão, não bug a corrigir agora:** o código já degrada sem quebrar (nenhum `reasoning` no retorno quando `reasoningAssembled` fica vazio, D21A.3) — 21-A fecha assim, documentado como limitação confirmada nesta conta, causa a esclarecer. Migrar para a Interactions API é item do `ROADMAP § 2`, condicionado a confirmar se `store: false` preserva o modelo stateless full-history-resend que D21A.6 assumiu impossível.

---

## Passos

### Passo 1 — O nome se resolve primeiro

Rename mecânico (D21A.4): `ThinkingMark.tsx`→`RespondingMark.tsx`, `useThinkingLoop.ts`→`useRespondingLoop.ts`, `ThinkingMark.test.tsx`→`RespondingMark.test.tsx` (ajusta os `describe`/imports), `tokens.css:114-124` e `tailwind.css:101-143` (tokens, `@utility` **e o `@keyframes dotThinking` da linha 117**), `ConversationView.tsx:23,256` (import e uso). **Conferência visual ao vivo obrigatória** depois — token/`@utility` do Tailwind só se confirma no CSS construído (skill `design-system`), não em `pnpm check:fast`.

### Passo 2 — Contrato: tipos e schema

`shared/ipc.ts`: `reasoningPartSchema` na união de `messagePartSchema`; `ChatReply` ganha `reasoning?: string` (mesmo padrão opcional de `promptTokens`); `ChatRequest` ganha `wantsReasoning?: boolean`; `JobEvent` ganha a variante do D21A.2; `argsSchema['ai:chat']` ganha `wantsReasoning: z.boolean().optional()`. `core/ai/types.ts`: `ChatFn` ganha `onThinking?`. `core/ai/chat.ts`: `runChat` threads `opts.onThinking` para `chat(...)`, mesmo padrão de `opts.onChunk`. `core/ai/messages.ts`: `case 'reasoning': return ''` em `partForProvider` (D21A.3) — o `switch` é exaustivo, o TypeScript recusa compilar sem o case.

### Passo 3 — Os três adaptadores leem e transportam

- **`ollama.ts`**: `think: opts.onThinking !== undefined` no corpo do POST (troca o `think: false` fixo da linha 194, com o comentário do *stopgap* removido). No parser NDJSON, lê `parsed.message?.thinking` ao lado de `parsed.message?.content`; chama `onThinking?.(piece)` e acumula em `reasoningAssembled`; inclui `reasoning: reasoningAssembled || undefined` no retorno (linha do `return` em `done === true` e no fallback de stream truncado — D21A do fallback, ver Passo 8).
- **`glm.ts`**: `thinking: { type: opts.onThinking !== undefined ? 'enabled' : 'disabled' }` (troca a linha 46). Lê `chunk.choices?.[0]?.delta?.reasoning_content`, mesma disciplina de acumulação/retorno.
- **`gemini.ts`**: `GeminiChunk`'s partes ganham `thought?: boolean`; `generationConfig.thinkingConfig` ganha `includeThoughts: opts.onThinking !== undefined` ao lado do `thinkingLevel: 'low'` que **não muda** (D21A.6 — não há "desligar" real nesta família, achado #3 do guia). Separa `parts` por `part.thought` antes de montar `piece`.

### Passo 4 — `main`: `handlers.ts` e `register-all.ts` encaminham

`ChatArgs` (`handlers.ts`) ganha `wantsReasoning?: boolean`. `chat()` monta `onThinking` condicionalmente (`wantsReasoning === true ? (text) => emit({ jobId, type: 'reasoning', text }) : undefined`) e passa para `chatFn`. `register-all.ts` repassa `args.wantsReasoning` do payload de `ai:chat` para `aiChat(...)`.

⚠️ **`measureChatTiming` não muda de código, mas muda de significado — e isso precisa ficar escrito, não implícito.** `t1` (TTFT) é marcado dentro do wrapper de `onChunk` (`chatTiming.ts:34-37`); `onThinking` vai direto para `emit`, fora desse wrapper. Com raciocínio ligado, `t1` continua marcando o primeiro *conteúdo*, não o primeiro token qualquer — ou seja, "tempo até primeiro token" no O-7 passa a incluir a fase inteira de raciocínio sem que nenhuma linha do painel mude. Decisão deste passo: **manter `t1` assim, mas nomear a definição num comentário no próprio `chatTiming.ts`** ("TTFT marca o primeiro chunk de CONTEÚDO, não de raciocínio — com o toggle ligado, o raciocínio inteiro conta como parte do TTFT") — para o O-9 herdar uma definição registrada, não uma surpresa a redescobrir.

### Passo 5 — Renderer: chega, monta, persiste

`useJobReasoning.ts` (novo, irmão de `useJobChunks.ts`): mesma forma, filtra `event.type === 'reasoning'`. `useConversationChat.ts`: `reasoningRef`/`streamingReasoning` ao lado de `partialRef`/`streaming` (linhas 63-70); no `append` de sucesso (linha 146-150), quando `result.value.reasoning` existe, `parts` ganha `{ kind: 'reasoning', text: result.value.reasoning }` **antes** da parte de texto.

⚠️ **O guard de interrupção (linha 160) descarta raciocínio parcial como está escrito hoje.** `if (stopped === null || partial === '') return` — um turno cancelado depois de começar a pensar mas antes do primeiro token de conteúdo tem `partial === ''` e retorna cedo, perdendo o raciocínio parcial junto. Este passo **amplia o guard** para `if (stopped === null || (partial === '' && reasoningPartial === '')) return`, e o `append` do bloco de interrupção (linha 161-166) ganha a mesma parte condicional de raciocínio do caminho de sucesso — inclusive quando `partial === ''` mas `reasoningPartial !== ''` (mensagem só com raciocínio, sem resposta, ainda é honesta o bastante para persistir, mesmo critério do D14.3).

⚠️ **A união de `MessagePart` alcança todo `switch`/`if` sobre `part.kind` no renderer, não só `partForProvider`.** Antes de fechar este passo, `grep -n "part.kind" src/renderer/` (e o equivalente em `core/`) para confirmar que `MessageList`/quem desenha cada parte trata (ou explicitamente ignora) `kind: 'reasoning'` — um `switch` exaustivo quebra a build sozinho, mas uma cadeia de `if`/`else` não avisa, e a nova parte simplesmente não desenharia nada em algum lugar que devia.

### Passo 6 — O toggle destrava

`AttachButton.tsx`: `disabled={!hasCapability(model, 'thinking')}` e `checked`/`onChange` reais na linha "Raciocínio visível" (D21A.5) — as outras duas linhas do array `TOOLS` continuam intocadas. `Composer.tsx`: estado local `wantsReasoning` ao lado de `attachment` (mesmo padrão `useState`), passado para `AttachButton` e para `onSend` (que ganha um terceiro parâmetro). `ConversationView.tsx`: fia o terceiro parâmetro até `send()`, que o encaminha em `window.api.ai.chat({ ..., wantsReasoning }, jobId)`.

⚠️ **Não confiar só no `disabled` do switch — mesmo precedente do `visionBlocked` (D17.11).** O switch desabilitado impede ligar o toggle para um modelo sem `thinking`, mas uma conversa já travada (`locked`, D15.13) pode ter o toggle ligado de um envio anterior e o modelo ter mudado de capacidade por fora (reinstalação, troca de conta). `send()`/`canSend` precisa reconferir `hasCapability(model, 'thinking')` no momento do envio, não confiar que a UI nunca deixou o estado divergir — mesmo argumento que já protege `visionBlocked` em `Composer.tsx:92-94`.

### Passo 7 — Exibição mínima

Bloco de texto corrido (sem colapsar, sem rótulo por provedor — D21A.8) na região que o Passo 1 libera em `ConversationView.tsx`, alimentado por `streamingReasoning` enquanto a resposta está em voo. Fica claramente marcado no código como provisório, para o 21-B substituir sem arqueologia.

### Passo 8 — Fallback de stream truncado

Decisão explícita (estava em aberto no guia): o fallback de stream interrompido do `ollamaChat` (`return { content: assembled }`, sem `done: true`) passa a incluir `reasoning: reasoningAssembled || undefined` também — um raciocínio parcial é tão digno de manter quanto o conteúdo parcial já é (`MessageStopped`, D14.3). Mesmo critério nos outros dois adaptadores, onde já existe caminho equivalente.

### Passo 9 — Testes e verificação ao vivo

Nível 1: `ollama.test.ts`, `glm.test.ts`, `gemini.test.ts` (thinking ligado/desligado, o filtro do D21A.6), `messages.test.ts` (`case 'reasoning'`). Nível 2: `AttachButton.test.tsx` — a asserção atual ("as três desligadas, incondicional") separa em duas: Busca web/Documentação continuam sempre desligadas, Raciocínio visível ganha um teste com modelo `thinking`-capable mostrando `disabled=false`; `RespondingMark.test.tsx` (renomeado) sem mudança de asserção, só de nome; `ConversationView.test.tsx` cobre a exibição mínima do Passo 7. Nível 3: `handlers.test.ts` (`wantsReasoning` chegando ao `chatFn` certo). Ao vivo, com `qwen3:4b`: confirma se `message.thinking` de fato intercala antes de `message.content` neste binário (0.32.14) — risco não medido, guia § *O que ainda não foi verificado*. Ao vivo, com `gemini-3.5-flash-lite`/`gemini-3.7-flash`: confirma se `part.thought` realmente chega em streaming nesta conta (achado #2 do guia, risco documentado, não bloqueante) — ⚠️ **é o único passo deste plano com custo fora da máquina**: gasta uma chamada real contra a conta de nuvem já configurada (chave em `secrets`), não uma sonda de metadados como o `/api/tags` do Ollama.

---

## O que **não** esperar deste plano

- O bloco recolhível elegante, com estado colapsado/expandido e rótulo por provedor — **21-B**.
- Qualquer painel novo no Observatório separando decode de raciocínio e de resposta — **O-9**, condicional, fora da numeração do arco 21.
- Mudança nas linhas "Busca web" e "Documentação (MCP)" do `AttachButton` — arcos 22/23.
- Anexo de código (`Código`, desabilitado incondicional) — sem plano ainda (F2.8).
- Redesenho da linha "Ferramentas" do popover — F2.6 proíbe.

---

## Diário de execução

| Data | O que foi feito |
|---|---|
| 02/09/2026 | Plano escrito nesta sessão, a partir do guia `reference/reasoning/README.md` (já revisado com o usuário em três rodadas: migração, O-9, rename do `ThinkingMark`, toggle já reservado). Submetido ao advisor Opus antes de fechar — quatro correções aplicadas (TTFT do O-7 precisa de comentário explícito no Passo 4, guard de interrupção do Passo 5 descartava raciocínio parcial, `@keyframes dotThinking` faltava no rename do Passo 1, `switch`/`if` sobre `part.kind` no renderer precisa de varredura) e duas notas menores (gate de capacidade no envio, não só no switch; custo de nuvem real no teste ao vivo do Gemini). |
| 02/09/2026 | **Passos 1–9 implementados e commitados** (um commit por passo, 7 commits de código + 2 de doc/teste). `pnpm check:fast` verde de ponta a ponta, 1308 testes. Achado ao vivo durante o Passo 5: o mock de `job.onEvent` nos testes guardava só o último listener — quebrou 4 testes ao `useJobReasoning` passar a assinar o mesmo canal que `useJobChunks`, corrigido com `stubJobEvents` (broadcast a todos os assinantes, mesma forma do preload real). Passo 8 (fallback de stream truncado) não gerou commit próprio — já resolvido dentro do Passo 3, cada adaptador já carrega `reasoning` no seu caminho de fallback. |
| 02/09/2026 | **Revisão final do advisor Opus sobre o código pronto — cinco achados, todos corrigidos.** (1) `AttachButton.tsx`: `checked` do switch de raciocínio só olhava `wantsReasoning`, não também `hasThinking` — corrigido para `wantsReasoning && hasThinking`, evita marcado+desabilitado simultâneos. (2) `reasoningPartSchema.text` sem `.min(1)` — verificado que `textPartSchema` já segue o mesmo padrão (sem constraint); não é lacuna, é a convenção existente. (3) O guard de interrupção do Passo 5 (`partial === '' && reasoningPartial === ''`) foi sabotado de volta para a forma antiga (`partial === ''` sozinho), o teste correspondente confirmadamente ficou vermelho (`test_related.mjs` pegou), guard restaurado e verde de novo — protocolo da skill `testing` cumprido, não só assumido. (4) Comentário do `chatTiming.ts` sobre TTFT/O-9 estava impreciso ("mistura" as duas taxas) — corrigido para nomear a consequência real: `decodeMs` exclui a fase de raciocínio mas `evalTokens` provavelmente a inclui, então o tokens/s do O-7 lê **mais rápido** que o decode de conteúdo real enquanto o toggle está ligado, viés numa direção só. Propagado para `docs/reference/reasoning/README.md` § Interação com o Observatório. (5) `docs/ESCOPO.md` linha 176 ainda descrevia o stopgap pré-21-A (`think: false` sempre) como fato atual — corrigido para refletir o que existe agora (raciocínio persiste, falta só o acabamento do 21-B); `ARMADILHAS.md` não precisou de edição, é log histórico e já nomeava 21-23 como destino do conserto. `pnpm check:fast` verde após as cinco correções (1308 testes). **Falta:** só a verificação ao vivo do usuário (qwen3:4b, Gemini) para fechar a sessão. |
| 02/09/2026 | **Segunda rodada do advisor sobre o código corrigido — dois achados reais, ambos resolvidos.** (1) A varredura de auto-conservação do rename `ThinkingMark→RespondingMark` nunca tinha rodado — `grep` sobre `docs/` e `.claude/skills/` achou 3 lugares vivos desatualizados: `.claude/skills/design-system/reference.md` (seção inteira ainda em `ThinkingMark`/`thinking-dot`/`dotThinking`, corrigida), `docs/ROADMAP.md` (tabela de arquivos acima da régua citava `useThinkingLoop.ts`, que não existe mais — remedida com os números atuais: `ConversationView.tsx` caiu para 357/400, dentro do teto de novo; `useConversationChat.ts` subiu para 225/120; `useRespondingLoop.ts` renomeado, 122/120 igual) e `docs/ARMADILHAS.md` (um link relativo morto para o arquivo renomeado, 11º invariante do `guard` — corrigido, prosa histórica mantida). `plan/implemented/`, `HISTORY-archive.md` e as demais menções em prosa são registro histórico legítimo (narram o F-1 como ele era), não tocados. (2) O fix do `checked` do Passo anterior não tinha teste — adicionado `reads unchecked when wantsReasoning is stale true but the model lost thinking`, sabotado (voltou ao `checked={wantsReasoning}` sem `&& hasThinking`), confirmado vermelho (`aria-checked` `true` em vez de `false`), restaurado e verde. `pnpm check:fast` verde, 1309 testes. |
| 02/09/2026 | **Verificação ao vivo do usuário — Ollama e GLM confirmados; Gemini investigado a fundo, achado mais sério que o risco #2 do guia.** `qwen3.5:2b` (Ollama, não `qwen3:4b` — a frota trocou desde a última medição): raciocínio aparece ao vivo durante o streaming e persiste na mensagem, inclusive com imagem anexada (visão + thinking simultâneos). `glm-4.7-flash`: raciocínio aparece e persiste. `gemini-3.5-flash-lite` **e** `gemini-3.7-flash`: nenhum texto de raciocínio em nenhum dos dois — 2/2, não intermitência. Investigação (Context7 + web search): a documentação atual do Google moveu todo exemplo de raciocínio visível para a **Interactions API**, com a frase explícita de que `generateContent`/`streamGenerateContent` (o endpoint que `gemini.ts` usa) só anexa assinaturas opacas, nunca texto — corroborado por relatos externos desde jan/2025. **Decisão (D21A.10, com o usuário): degradar graciosamente.** O código já não quebra (nenhum `reasoning` no retorno quando vazio); documentado como limitação conhecida em `ESCOPO.md`, `reference/reasoning/README.md` e um comentário em `gemini.ts`. Migração para a Interactions API vira gatilho novo do `ROADMAP § 2`, condicionado a `store: false` provar que preserva o modelo stateless — não decidido, não investigado a fundo agora. `pnpm check:fast` verde, 1309 testes. |
| 02/09/2026 | **Terceira rodada do advisor — a conclusão "estrutural, nunca funcionou" (D21A.10) estava acima da evidência.** A frase citada da doc do Google ("does not provide dedicated thought blocks, instead attaching signatures as metadata") fala de **assinaturas opacas** em contexto de function calling, não do texto do resumo — usá-la para concluir sobre o resumo era ler além do que ela diz; e o próprio comentário do adaptador já registrava um HTTP 400 medido ao vivo em N-1-C, prova de que o endpoint validava `thinkingConfig` de verdade em algum momento — incompatível com "nunca teria entregue". Suavizado em quatro lugares (D21A.10, `ROADMAP.md`, `ESCOPO.md`, `reference/reasoning/README.md` § 2) para a alegação que a evidência sustenta: confirmado 2/2 nesta conta, causa a esclarecer. **Achado lateral, corrigido:** `gemini.ts` citava `gemini-3.1-flash-lite` num comentário — modelo real, mas não o integrado; o catálogo usa `gemini-3.5-flash-lite` (página oficial própria, testado ao vivo em N-1-C). Corrigido no comentário e nas duas outras ocorrências vivas (`docs/plan/active/21-A...md`, `reference/reasoning/README.md`); as menções em `HISTORY-archive.md`/`plan/implemented/N-1-C...md` são registro histórico, não tocadas. `pnpm check:fast` verde, 1309 testes. |
