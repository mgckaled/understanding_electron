# N-1-C — Gemini de ponta a ponta, catálogo de nuvem no seletor, janela de contexto cloud-aware

**Depende de:** [N-1-A](../implemented/N-1-A-segredo-de-nuvem.md) (sistema de segredo, `secrets:has`/`write`/`remove`, `CLOUD_PROVIDERS`) · [N-1-B](../implemented/N-1-B-provedor-glm-ponta-a-ponta.md) (segundo `AiService`, o resolver de `register-all.ts`, `checkLevel3`, os hooks parametrizados por serviço) · [`cloud-optin-implementation-guide.md`](../../reference/cloud-optin-implementation-guide.md) (Peças A–G) · [`cloud-optin.md`](../../reference/models/cloud-optin.md). **Entrega:** terceiro valor de `AiService` (`gemini`), com dois modelos pinados (`gemini-3.5-flash-lite`, `gemini-3.7-flash`); o seletor de modelo passa a mostrar contexto, limite de taxa e capacidades para **os dois** provedores de nuvem, no mesmo padrão visual da fileira Locais; o botão do GLM ganha a affordance de clicável que hoje falta; e a janela de contexto para de travar em 32k quando um modelo de nuvem é escolhido — bug que já afeta o GLM hoje e afetaria o Gemini do mesmo jeito se não fosse corrigido aqui.

> **Este é o plano que fecha a trilha N-1.** Decidido com o usuário em 25/08/2026, com as duas opções postas lado a lado: continuar a numerar dentro de N-1 (um `N-1-D` para provedor terceirizado) ou fechar N-1 em Gemini e abrir uma trilha nova. Vitória da segunda — o critério é a própria carta do `ROADMAP § 1`: N-1 é "arquitetura mínima de modelos de nuvem/opt-in", e Gemini + cota é o que fecha essa carta. Groq/Cerebras/SambaNova (Peça F) não são arquitetura mínima, são amplitude sobre uma arquitetura já fechada — camada extra de checagem, proeminência de UI em aberto, formato de wire confirmado só para a Groq. Isso é pesquisa, não implementação, e nasce como **trilha N-2** quando alguém escrever o primeiro arquivo dela — nenhum arquivo nasce aqui.

**Fora deste plano — decidido nesta sessão, com o advisor:**

- **Peça E, a parte que falta: contagem e imposição real de cota.** Este plano **exibe** RPM/TPM/RPD documentados (dado estático, tabela chumbada — Peça C) e nada além disso. Não há contador de requisições, não há fila, não há um `AppError.kind` novo para "estourei a cota" — uma chamada além do limite ainda estoura como `upstream` genérico, o mesmo tratamento que N-1-B já deu à concorrência-1 do GLM. A pergunta "qual `kind` representa cota estourada" (guia, Peça E) segue em aberto.
- **A API "Interactions" da Google** (`/v1beta/interactions`, eventos nomeados, `previous_interaction_id`). É o caminho que a própria doc do Gemini está empurrando para modelos novos, mas é **stateful** — cada turno referencia o anterior por id guardado no servidor do provedor, e todo o resto do app (Ollama, GLM) é stateless: reenvia o histórico inteiro a cada chamada. Adotar Interactions para o Gemini seria uma segunda forma de conversar com um provedor, e um plano à parte. Este plano usa o endpoint clássico (`streamGenerateContent`), que continua servido e aceita os parâmetros novos (`thinkingLevel`) — ver DN1C.5 e o Risco 1 sobre o que ainda precisa ser confirmado ao vivo.
- **Trilha N-2 (Groq/Cerebras/SambaNova).** Não tocada — nem placeholder novo. O placeholder que existia para "Gemini" (`CLOUD_PLACEHOLDERS`) é removido, não substituído: nenhum provedor de N-2 tem UI reservada hoje, e reservar uma agora seria desenhar para um plano que ainda não existe.
- **Migração de conversas já travadas em 32.768 tokens por causa do bug.** Não precisa de migração de dado — DN1C.2 muda a leitura (`conversationWindow`), não a escrita: uma conversa de nuvem já existente volta a ficar ajustável assim que este plano roda, sem tocar uma linha do banco.

---

## Contexto

**O achado que abriu este plano, fora do que foi pedido:** ao revisar o seletor de modelo para adicionar a exibição de limite de nuvem, apareceu um bug real e já em produção — selecionar o GLM trava a janela de contexto em 32.768 tokens, sem controle nenhum para mudar (usuário, sessão de 25/08/2026, com captura de tela). Rastreado até a raiz: `contextCeiling` (`core/ai/memory.ts`) devolve `null` para qualquer modelo com `attention: null` — o que é a leitura **certa** para "não custa RAM local, não bloqueie por RAM" (`fitsInMemory(null) === true`, DN1B.2), mas é a leitura **errada** para "qual o teto que a barra deslizante deve oferecer": sem teto nenhum, `effectiveNumCtx` (`core/ai/budget.ts`) cai no `DEFAULT_NUM_CTX` (32.768, um número pensado para o custo de prefill do Ollama nesta CPU) sem nunca clampar contra nada — e o próprio `ContextControl.tsx` exige `ceiling !== null` só para desenhar a barra, então a barra nunca aparece. Uma conversa de nuvem trava (D15.13) nesse valor no primeiro envio e fica lá para sempre, sem UI para mudar.

**Por que isto é maior que um ajuste visual:** `num_ctx` **não existe na nuvem** — nem GLM nem Gemini recebem esse parâmetro na chamada real (`makeGlmChat` manda `{model, messages, stream, thinking}`, sem janela nenhuma; o guia já registrava isso na abertura: "não há janela a reservar, só envio e cobrança/recusa"). Para um modelo local, `numCtx` é uma reserva real de RAM que pode ficar inviável depois (por isso o *lock* do D15.13 existe: proteger contra RAM que varia 3 GB nesta máquina). Para nuvem, `numCtx` é **só** o denominador do medidor de orçamento e o teto do portão de recusa (D15.5) — nada é alocado, nada fica "impagável" depois. O *lock* trava a identidade do modelo (D15.13 continua protegendo isso), mas travar o **número** da janela de nuvem não protege nada — só reproduz, para um recurso sem custo, uma cautela pensada para um recurso com custo.

**A pesquisa desta sessão, obrigatória via Context7, mudou o desenho do adaptador em relação ao que o guia (Peça G) previa:** a doc oficial do Gemini hoje empurra dois formatos coexistindo — o clássico `generateContent`/`streamGenerateContent` ("legacy" nos títulos da própria doc) e uma API nova, "Interactions" (`/v1beta/interactions`), que é **stateful**: o checklist de migração para `gemini-3.7-flash` diz textualmente que conversa de múltiplos turnos "deve padronizar em `previous_interaction_id` do lado do servidor e eliminar turnos de modelo pré-preenchidos" — exatamente o oposto do que o app faz hoje (reenviar `messages[]` inteiro a cada chamada, para Ollama e GLM). A página do próprio `gemini-3.1-flash-lite` mostra o parâmetro novo de raciocínio (`thinking_level`, substituindo o antigo `thinking_budget`) funcionando dentro do endpoint clássico via `client.models.generate_content(...)` — então o caminho clássico continua servido e aceita o parâmetro novo. Este plano fica no clássico (DN1C.5); o Risco 1 registra o que ainda não foi confirmado ao vivo.

---

## Decisões

### DN1C.1 — Terceiro valor de `AiService`, e o mapa exaustivo de novo

```ts
// src/shared/ipc.ts
export const aiServiceSchema = z.enum(['ollama', 'glm', 'gemini'])
```

Mesma costura que N-1-B pagou uma vez: `Record<AiService, string>` é exaustivo em pelo menos dois lugares (`HINTS` em `main/features/ai/handlers.ts`, `SERVICE_LABEL` em `ConversationView.tsx`) e `pnpm typecheck` reprova os dois assim que o enum ganha `'gemini'` — as duas entradas entram no passo 1, lição já registrada por N-1-B para não redescobrir aqui. Grep por `Record<AiService` antes de fechar o passo confirma que não sobrou um terceiro mapa.

### DN1C.2 — Janela de contexto cloud-aware, dois pontos de mudança

**Ponto 1 — o teto que a barra oferece.** Em vez de mudar `contextCeiling` (RAM pura, `core/ai/memory.ts`, com testes que documentam "não custa" como `null`), o desvio entra na composição de `ConversationView.tsx`, que já é quem decide qual função chamar:

```ts
// ConversationView.tsx
const ceilingOf = (entry: AiModel): number | null =>
  entry.attention === null
    ? entry.contextLength
    : memory === undefined
      ? null
      : contextCeiling(entry, memory.freeBytes, RAM_MARGIN_BYTES)
```

`attention === null` já é o sinal estabelecido para "não custa RAM local" (DN1B.2) — reaproveitado aqui, não um segundo jeito de perguntar "isto é nuvem?". `contextCeiling`/`memory.test.ts` não mudam uma linha: um modelo Ollama sem `attention` (embedder, ou um `/api/show` malformado) segue existindo, mas nunca chega aqui de verdade — `selectableModels()` (D15.11) já filtra embedder fora da lista selecionável antes de qualquer `ceilingOf` ser chamado num modelo de conversa real.

**Ponto 2 — o *lock* não deveria congelar um número que nada aloca.** `conversationWindow` (`core/ai/budget.ts`) ganha um parâmetro:

```ts
export function conversationWindow(input: {
  locked: boolean
  reserved: number | undefined
  ceiling: number | null
  /**
   * Whether this window is a real local RAM reservation (Ollama) that can
   * become unaffordable later, or a client-side budget bound only, never
   * sent to the provider (cloud) — see DN1C.2. The lock protects against
   * the first; the second has nothing to protect against, so it always
   * re-derives instead of freezing.
   */
  costed: boolean
}): ConversationWindow {
  const { locked, reserved, ceiling, costed } = input

  if (costed && locked && reserved !== undefined) {
    return ceiling === null || reserved <= ceiling
      ? { status: 'locked', numCtx: reserved }
      : { status: 'unaffordable', numCtx: reserved }
  }

  const derived = effectiveNumCtx(reserved, ceiling)
  if (derived === null) return { status: 'too-large' }
  return { status: locked && costed ? 'locked' : 'open', numCtx: derived }
}
```

`costed = current?.attention !== null` no chamador. Efeito: uma conversa de nuvem nunca entra em `'locked'`/`'unaffordable'`/`'too-large'` — sempre `'open'`, sempre com a barra visível e ajustável em `ContextControl`, mesmo depois do primeiro envio. `'unaffordable'` e `'too-large'` já eram estruturalmente inalcançáveis para nuvem uma vez que o Ponto 1 dá um teto real (`fitsInMemory(model.contextLength)` é sempre verdadeiro para um `contextLength` positivo) — o parâmetro `costed` só formaliza isso, em vez de deixar como coincidência de dois números que nunca colidem.

**O que NÃO muda:** o booleano `locked` em si (D15.13) continua travando a **identidade** do par `(modelo, serviço)” em todo o resto do app — `ModelPicker` continua desabilitado, a mensagem "modelo não instalado" continua valendo. Só o *número* da janela de nuvem deixa de congelar.

**O default continua 32.768 para nuvem, de propósito — decisão explícita, não sobra do código antigo.** Depois deste fix, uma conversa Gemini nova ainda cai em `effectiveNumCtx(undefined, 1_048_576) = DEFAULT_NUM_CTX = 32.768`, não no teto de 1M: o motivo de reservar grande no Ollama era custo de prefill local, que não existe aqui, mas o motivo de reservar **pequeno** por padrão continua existindo — um número maior é um envio maior contra o TPM/RPD do dia (Peça E), e a barra (agora sempre visível para nuvem, Ponto 2) é o jeito do usuário decidir por conversa, não o app decidir por ele. Se `DEFAULT_NUM_CTX` acabar parecendo baixo demais na verificação ao vivo do passo 7, é essa a leitura a revisitar — não um valor esquecido.

**Efeito colateral desejado, não migração:** uma conversa GLM já gravada com `numCtx: 32768` (o valor errado, escrito enquanto o bug existia) volta a mostrar a barra e a aceitar ajuste no próximo carregamento — `reserved` (o que está no banco) vira só o valor inicial de `effectiveNumCtx`, não mais um número congelado. Nenhuma migração de banco, nenhuma reescrita de linha.

### DN1C.3 — `AiModel` ganha um limite de exibição, forma discriminada — não um trio fixo

GLM publica **concorrência 1** (terceiro, `cloud-optin.md`), não RPM/TPM/RPD — um trio fixo forçaria inventar números que o próprio Z.ai não publica, exatamente o que a legenda de proveniência de `cloud-optin.md` existe para impedir. Cada provedor expressa a forma real do próprio limite:

```ts
// src/shared/ipc.ts — tipo puro, sem schema zod (payload main→renderer, ver skill ipc)
export type CloudRateLimit =
  | { kind: 'rate'; rpm: number; tpm: number; rpd: number }
  | { kind: 'concurrency'; max: number }

export type AiModel = {
  // ...campos existentes
  /** Documented free-tier limit, display only (Peça E display, not enforcement) — undefined for Ollama, which has no account-wide quota concept. */
  rateLimit?: CloudRateLimit
}
```

Nasce em `core/ai/models.ts`, nos dois catálogos pinados — nunca num mapa paralelo do renderer. N-1-B já estabeleceu que o renderer importa `GLM_MODELS` direto de `@core/ai/models`, sem round-trip por IPC (achado de execução daquele plano, colisão com mock de `ai:models` em teste) — `rateLimit` viaja no mesmo objeto, sem canal novo.

```ts
export const GLM_MODELS: AiModel[] = [
  {
    // ...campos existentes, inalterados
    rateLimit: { kind: 'concurrency', max: 1 }
  }
]

export const GEMINI_MODELS: AiModel[] = [
  {
    provider: 'gemini',
    name: 'gemini-3.5-flash-lite',
    parameterSize: '',
    sizeBytes: 0,
    capabilities: ['completion', 'tools', 'vision', 'thinking'],
    contextLength: 1_048_576,
    attention: null,
    variantOf: null,
    rateLimit: { kind: 'rate', rpm: 15, tpm: 250_000, rpd: 500 }
  },
  {
    provider: 'gemini',
    name: 'gemini-3.7-flash',
    parameterSize: '',
    sizeBytes: 0,
    capabilities: ['completion', 'tools', 'vision', 'thinking'],
    contextLength: 1_048_576,
    attention: null,
    variantOf: null,
    rateLimit: { kind: 'rate', rpm: 5, tpm: 250_000, rpd: 20 }
  }
]
```

Números RPM/TPM/RPD conferidos ao vivo pelo usuário no console do Google AI Studio em 25/08/2026 (`notes/nuvem/gemini.md`) — proveniência **medido**, mais forte que os agregadores de terceiro que `cloud-optin.md` hoje cita para `gemini-2.5-flash`. `contextLength: 1_048_576` vem da FAQ oficial "O modelo suporta uma janela de contexto de entrada de 1 milhão de tokens" (`ai.google.dev/gemini-api/docs/whats-new-gemini-3.5`) — **não** foi confirmado numa página de especificação dedicada a cada um dos dois modelos nesta sessão; reconfirmar (`client.models.get(model).input_token_limit`, forma que a própria doc mostra) é o Risco 2.

**A escolha dos dois modelos, motivo registrado:** o `gemini-3.7-flash` é o de raciocínio mais forte da família (20 RPD, ~4 conversas/dia de 5 perguntas), o `gemini-3.5-flash-lite` é o de uso diário (500 RPD, ~100 conversas/dia) — mesma capacidade de entrada (visão, `thinking`) nos dois, a diferença real é profundidade de raciocínio sob tarefa agêntica longa, não presença de recurso. Cobre os dois cenários que motivaram a proposta do usuário, com uma única chave.

### DN1C.4 — Exibição no seletor: mesmo padrão da fileira Locais, adaptado por forma de limite

`ModelSelector.tsx` ganha um formatador pequeno e uma segunda linha nas linhas de nuvem, no mesmo `className="flex flex-wrap items-center gap-2 ..."` que a fileira Locais já usa — **`flex-wrap` não é opcional**: é a exata classe cuja ausência já produziu o defeito de wrap/corte em telas mais estreitas, registrado duas vezes no projeto.

```ts
// modelFormat.ts — TPM é número redondo decimal (250.000), não potência de 1024
// como contextLength; formatContext divide por 1024 de propósito, reaproveitá-lo
// aqui daria "244k" em vez de "250k".
export function formatRateLimit(limit: CloudRateLimit): string {
  return limit.kind === 'concurrency'
    ? `${limit.max} simultânea${limit.max === 1 ? '' : 's'}`
    : `${limit.rpm} RPM · ${Math.round(limit.tpm / 1000)}k TPM · ${limit.rpd} RPD`
}
```

```tsx
// ModelSelector.tsx — dentro do cloudModels.map, substituindo o <button> de uma linha só.
// Cor de texto e disabled:* ficam TODOS no <button>, nunca num <span> filho —
// `disabled:*` compila para `&:disabled`, que só existe no elemento que pode
// de fato estar desabilitado; um span com essa classe é CSS morto (achado do
// advisor). Os spans internos não fixam cor própria, herdam do botão.
<button
  key={model.name}
  type="button"
  disabled={!cloudReadyFor(model.provider)}
  title={cloudReadyFor(model.provider) ? undefined : cloudHintFor(model.provider)}
  onClick={() => { onSelect(model.name); setOpen(false) }}
  className="flex cursor-pointer flex-col gap-1 rounded-md border border-transparent px-4 py-2 text-left text-text hover:border-border hover:bg-surface-raised disabled:cursor-not-allowed disabled:text-text-faint disabled:hover:border-transparent disabled:hover:bg-transparent"
>
  <span className="font-ui text-md">{model.name}</span>
  <span className="flex flex-wrap items-center gap-2 text-2xs text-text-muted">
    {model.contextLength !== null && <span>{formatContext(model.contextLength)} de contexto</span>}
    {model.rateLimit !== undefined && <span>{formatRateLimit(model.rateLimit)}</span>}
    {capabilityChips(model).map((chip) => <CapabilityChip key={chip.capability} {...chip} />)}
  </span>
</button>
```

**O que corrige a falta de affordance do GLM (pedido explícito do usuário — a única mudança deste plano que toca o botão do GLM em si, não seu catálogo nem seu adaptador):** `cursor-pointer` explícito (herdar do `<button>` nativo não bastava — Chromium não aplica pointer a botão por padrão sem essa classe, e é por isso que a fileira Locais já a escreve à mão em cada linha), borda transparente que vira `border-border` visível e `bg-surface-raised` no hover — mesmo par (borda + fundo) que a fileira Locais usa para "isto é clicável" em `role="option"`. Aplica-se aos dois provedores de nuvem igualmente, não só ao GLM: não haveria como diferenciar "o GLM é clicável" de "o Gemini é clicável" com uma regra por provedor sem duplicar CSS à toa.

`cloudReadyFor`/`cloudHintFor` substituem os antigos `cloudReady`/`cloudHint` (booleano único) — agora dois provedores, duas chaves possíveis independentes (`useCloudSecret('glm')` e `useCloudSecret('gemini')` são consultas separadas, D9.1). **`model.provider` é tipado `AiService` (`ollama|glm|gemini`), não `CloudProvider` (`gemini|glm`)** — indexar um `Record<CloudProvider, ...>` por ele não compila. `ModelPicker` recebe `Partial<Record<AiService, boolean>>`/`Partial<Record<AiService, string | undefined>>` (só as chaves de nuvem preenchidas; `cloudReadyFor` faz `map[provider] ?? false`), e `isCloudService` (`core/ai/messages.ts`, DN1B.6 — já é `service !== 'ollama'`) é o guard reaproveitado onde a distinção precisar de narrowing de tipo, em vez de inventar um segundo.

`CLOUD_PLACEHOLDERS` (`['Gemini']`) é **removido**, não esvaziado — nenhum consumidor sobra depois deste plano, e reservar o padrão para a trilha N-2 seria desenhar para um plano que ainda não existe (mesmo raciocínio que já apagou `Panel`/`Toolbar` no DS-8: zero chamador é o gatilho, não a previsão de um chamador futuro).

**Popover mais largo.** `w-[300px]` → `w-[380px]` em `ModelSelector.tsx` — a segunda linha de nuvem agora carrega contexto + limite + até três chips na mesma largura que antes só a fileira Locais precisava (que já tinha isso). Número escolhido por paralelo com `ContextControl.tsx`, que já é `w-[360px]` pelo mesmo motivo (rótulos da régua); confirmar ao vivo que nenhuma linha quebra feio nos dois temas antes de fechar o passo — é o aceite, não suposição.

### DN1C.5 — Adaptador Gemini: `streamGenerateContent` clássico, `contents`/`role` mapeados, `x-goog-api-key`

Mesma forma de `glm.ts` (fábricas `ProbeFn`/`ChatFn` injetadas com `hasKey`/`getApiKey`, fetch cru, sem SDK) — três diferenças reais, não cosméticas, que a pesquisa desta sessão encontrou:

```ts
// src/main/features/ai/providers/gemini.ts
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

// Legacy streamGenerateContent + ?alt=sse (Context7, N-1-C) — NÃO a API
// Interactions nova, que quer previous_interaction_id do lado do servidor e
// quebraria o modelo stateless que o resto do app usa (ver "Fora deste
// plano"). ?alt=sse é o que troca o array JSON chunk-a-chunk padrão por
// eventos "data: {...}" de verdade — sem isso a resposta não é
// linha-delimitada e o parser de glm.ts não serviria.
function streamUrl(model: string): string {
  return `${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse`
}

// Gemini usa role 'model', não 'assistant', e não tem role 'system' dentro de
// `contents` — vai em `systemInstruction`, campo separado. As duas diferenças
// reais em relação ao shape OpenAI-compatible que glm.ts consome.
function toGeminiContents(messages: ChatMessage[]): unknown[] {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
}

function systemInstructionOf(messages: ChatMessage[]): unknown | undefined {
  const system = messages.find((m) => m.role === 'system')
  return system === undefined ? undefined : { parts: [{ text: system.content }] }
}

export function makeGeminiProbe(hasKey: () => boolean): ProbeFn {
  return async () => {
    if (!hasKey()) throw new UpstreamError(null, 'no api key stored')
    return 'gemini-3.7-flash'
  }
}

export function makeGeminiChat(getApiKey: () => string | null): ChatFn {
  return async (messages, { model, signal, onChunk }) => {
    const apiKey = getApiKey()
    if (apiKey === null) throw new UpstreamError(null, 'no api key stored')

    const response = await fetch(streamUrl(model), {
      method: 'POST',
      // x-goog-api-key, não Authorization: Bearer — confirmado via Context7
      // contra a doc oficial, diferente do padrão OpenAI-compatible do GLM.
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: toGeminiContents(messages),
        ...(systemInstructionOf(messages) !== undefined
          ? { systemInstruction: systemInstructionOf(messages) }
          : {}),
        // thinkingLevel substitui thinkingBudget para a geração 3.x (Context7).
        // 'minimal' é o mais próximo de "desligado" que a família 3.x aceita —
        // não existe um 'disabled' como o do GLM. Mesmo estopgap adiado para
        // os planos 21-23 (ver glm.ts).
        generationConfig: { thinkingConfig: { thinkingLevel: 'minimal' } }
      }),
      signal
    })
    // parse SSE: linhas "data: {...}", candidates[0].content.parts[].text,
    // usageMetadata.{promptTokenCount,candidatesTokenCount} do último chunk que o carrega —
    // mesma forma de loop que glm.ts, shape de JSON diferente.
  }
}

export const geminiLoaded: LoadedFn = async () => []
export const geminiUnload: UnloadFn = async () => {}
export const geminiModels: ModelsFn = async () => GEMINI_MODELS
```

`readSecretForUse`/`register-all.ts`'s `decryptSecret` **não mudam** — já genéricos por `CloudProvider` desde N-1-B (`readSecretForUse(provider, db, decrypt)`); `getGeminiApiKey = () => readSecretForUse('gemini', db, decryptSecret)` é toda a costura nova ali.

### DN1C.6 — `register-all.ts`: resolver de três vias

```ts
function resolveProvider(service: AiService, glm: ProviderAdapter, gemini: ProviderAdapter): ProviderAdapter {
  if (service === 'glm') return glm
  if (service === 'gemini') return gemini
  return ollamaAdapter
}
```

Mesmo formato de N-1-B, um `if` a mais. `checkLevel3`/`isCloudService` (`core/ai/messages.ts`, DN1B.6) **não mudam** — `isCloudService` já é `service !== 'ollama'`, cobre `'gemini'` de graça, e a recusa de nível 3 (documento/imagem) já se aplica ao Gemini sem uma linha nova, apesar de o Gemini enxergar imagem de verdade (é a mesma tensão que a Peça D já registrava para `gemini-2.5-flash`, agora correta para a família 3.x inteira — ver passo de fechamento).

---

## Passos

Cada linha é **um commit**, na ordem da tabela — a ordem de dependência abaixo é o motivo de não embaralhar.

| # | Entrega | Testes | Aceite |
|---|---|---|---|
| **1** | `shared/ipc.ts`: `aiServiceSchema` ganha `'gemini'` (DN1C.1); `AiModel` ganha `rateLimit?: CloudRateLimit` (DN1C.3, tipo só). `main/features/ai/handlers.ts`: `HINTS.gemini`. `ConversationView.tsx`: `SERVICE_LABEL.gemini` | Nível 1: `argsSchema`/`aiServiceSchema` aceitam `'gemini'` | `pnpm typecheck` verde nos três projetos; grep por `Record<AiService` confirma que não sobrou terceiro mapa exaustivo |
| **2** | `core/ai/budget.ts`: `conversationWindow` ganha `costed` (DN1C.2, Ponto 2). `ConversationView.tsx`: `ceilingOf` cloud-aware (DN1C.2, Ponto 1), `costed` calculado e passado | Nível 1: `budget.test.ts` — `conversationWindow` com `costed: false` nunca devolve `'locked'`/`'unaffordable'`/`'too-large'`, mesmo com `locked: true` e `reserved` acima do teto antigo; `costed: true` reproduz exatamente o comportamento anterior (regressão zero para Ollama) | `pnpm check:fast` verde; verificado ao vivo (`pnpm dev`) contra uma conversa GLM **já existente** de antes deste plano: a barra aparece e aceita arrasto, sem editar o banco |
| **3** | `core/ai/models.ts`: `GLM_MODELS[0].rateLimit` (concorrência). `modelFormat.ts`: `formatRateLimit` (DN1C.4). `ModelSelector.tsx`: segunda linha nas linhas de nuvem, affordance de clicável (cursor/hover/borda), popover `w-[380px]`, `cloudReadyFor`/`cloudHintFor` por provedor — feito só contra o GLM nesta etapa (Gemini ainda não existe no catálogo) | Nível 2: `modelSelection.test.tsx` — a linha do GLM mostra contexto + "1 simultânea" + chips; testa **comportamento**, não classe CSS (achado do advisor: `className` contendo `cursor-pointer` é a mesma amarração que a skill `testing` já nomeia — verifica a string que acabou de ser digitada, não um bug): a linha é alcançável por `role`, o clique chama `onSelect` com o nome do modelo quando há chave, e o botão fica `disabled` (não dispara `onSelect`) quando não há; popover não perde nenhum item de conteúdo com a segunda linha | Verificado ao vivo, os dois temas — cursor/hover/contraste ficam **só** aqui, é onde são verificáveis de verdade: hover do GLM mostra borda+fundo como uma linha de Locais, cursor vira pointer; linha sem chave lê esmaecida (`text-text-faint`) nos dois temas, não só quando tem foco; nenhum wrap feio na segunda linha — aceite explícito, não suposto (achado do advisor: isto já mordeu duas vezes) |
| **4** | `core/ai/models.ts`: `GEMINI_MODELS`, dois modelos (DN1C.3) | Nível 1: forma de cada entrada (`capabilities` inclui `'completion'`, `rateLimit.kind` corresponde ao provedor) | `pnpm check:fast` verde |
| **5** | `main/features/ai/providers/gemini.ts` completo (DN1C.5) — **primeiro sub-passo, antes de escrever o parser: uma chamada real contra `streamGenerateContent` para `gemini-3.7-flash` com um `contents` de três turnos (`user`/`model`/`user`), confirmando que o endpoint clássico aceita histórico pré-preenchido** (Risco 1 — se a API recusar, este passo pára aqui e o adaptador vira Risco documentado, não código que finge funcionar) | Nível 1: mesmo padrão de `ollama.test.ts`/`glm.test.ts` — fetch stub, `toGeminiContents` mapeia `assistant→model` e extrai `system` para `systemInstruction`, parser SSE multi-linha (chunk partido no meio, mesmo teste que os outros dois adaptadores já fazem), lê `usageMetadata` do último chunk que o carrega | `pnpm check:fast` verde; grep por `decryptString` confirma que só `register-all.ts` chama `safeStorage` |
| **6** | `register-all.ts`: `getGeminiApiKey`, `resolveProvider` de três vias (DN1C.6), os cinco `handle('ai:*', ...)` cobrindo `'gemini'` | Nível 3: `handlers.test.ts` — `chat()` com `service: 'gemini'` e anexo de imagem devolve `{kind: 'blocked'}` sem chamar `chatFn` (mesma regressão que N-1-B provou para o GLM, agora para o Gemini) | `pnpm check:fast` verde |
| **7** | Renderer: `cloudModels = [...GLM_MODELS, ...GEMINI_MODELS]`; `allModels` (union) já genérico desde N-1-B, confirmar que resolve os três provedores; `useCloudSecret('gemini')` ao lado do `('glm')` já existente, alimentando `cloudReadyFor`/`cloudHintFor` (DN1C.4); `CLOUD_PLACEHOLDERS` removido | Nível 2: escolher `gemini-3.5-flash-lite` antes do primeiro envio não reverte para o primeiro modelo Ollama (mesma regressão que N-1-B provou para o GLM); uma conversa Gemini travada resolve `model` normalmente ao recarregar | Verificado ao vivo, os dois temas: mandar mensagem de texto simples para os dois modelos Gemini e receber streaming real; anexar imagem com Gemini selecionado e ver a recusa `blocked` (a tensão da Peça D — modelo que declara visão, anexo recusado mesmo assim — visível ao vivo, não só em teste) |
| **8** | Fechamento: `ESCOPO.md`/guia corrigidos — Peça D passa a dizer "a família Gemini 3.x inteira, incluindo as variantes Lite" em vez de só `gemini-2.5-flash` (auto-conservação, fato que tinha envelhecido). `cloud-optin.md`: seção `gemini-2.5-flash` substituída pelas fichas de `gemini-3.5-flash-lite`/`gemini-3.7-flash`, números marcados **medido** (AI Studio, 25/08/2026). Diário preenchido; candidatos a `HISTORY.md` — o bug do `costed`, a escolha do endpoint clássico sobre Interactions, a forma discriminada de `rateLimit`. `ROADMAP.md` marca N-1 concluído em N-1-C, N-2 registrada como trilha nova sem arquivo | — | `pnpm check:fast` verde; `ipc` skill recontada contra `argsSchema` (nenhum canal novo nasceu — só o enum de `service` ampliou, mesmo padrão do N-1-B); `ConversationView.tsx` medido contra o teto de 400 linhas (já estava em 392 ao fim do N-1-B) — se estourar, dividir agora em vez de adiar de novo |

---

## Ordem de dependência

```
1 (contrato) ──► 2 (janela cloud-aware) ──► 3 (exibição + fix GLM, provando o desenho contra um provedor que já funciona)
                                                    │
                                                    ▼
                                         4 (catálogo Gemini) ──► 5 (adaptador) ──► 6 (resolver + gate) ──► 7 (UI final) ──► 8 (fechamento)
```

O passo 3 é deliberadamente antes do 4: toda a mudança visual e de comportamento (affordance, segunda linha, popover largo, janela que não trava) é verificável contra o GLM, que já funciona ponta a ponta hoje. Se o passo 5 esbarrar no Risco 1 (endpoint clássico recusando histórico pré-preenchido), os passos 1–3 já entregaram valor sozinhos — a correção do bug e a exibição não dependem do Gemini existir.

---

## Riscos

1. **Endpoint clássico (`streamGenerateContent`) pode não aceitar `contents` de múltiplos turnos para `gemini-3.7-flash`** — o checklist de migração da própria doc diz que conversas de múltiplos turnos "devem padronizar" na API Interactions nova, com `previous_interaction_id`. Não confirmado nesta sessão (exigiria uma chamada real com a chave do `.env`, fora do escopo de uma sessão de planejamento). **Verificação vira o primeiro sub-passo do passo 5**, antes de qualquer parser ser escrito — se recusar, este plano pára no passo 4 executado e o adaptador Gemini vira um plano à parte, com a API Interactions como escopo novo (stateful, guarda `interaction_id` por conversa — mudança de modelo de dados, não deste plano).
2. **`contextLength: 1_048_576` para os dois modelos não veio de uma página de especificação dedicada a cada um** — veio da FAQ da geração 3.5 mais o padrão histórico da família Flash. Reconfirmar com `client.models.get(model).input_token_limit` (forma que a própria doc mostra) no passo 4, antes de gravar em `GEMINI_MODELS`.
3. **Corpo de erro não-2xx do Gemini não foi pesquisado** — mesmo risco que N-1-B já registrou para o GLM. Tratamento genérico (`UpstreamError(status, ...)`) é aceitável para abrir o provedor; a mensagem de um 401/429 não vem do corpo real.
4. **`thinkingLevel`/`systemInstruction` são nomes de campo REST inferidos da convenção camelCase do resto da API** (`usageMetadata`, `promptTokenCount`), não confirmados campo-a-campo contra uma resposta real. Mesma disciplina do Risco 1 de N-1-A (`Buffer.from` sobre `Uint8Array`): julgamento sobre doc, o passo 5 prova ao vivo.
5. **`ConversationView.tsx` pode estourar o teto de 400 linhas** — já em 392 ao fim de N-1-B, candidato a divisão registrado e adiado uma vez. Este plano acrescenta `costed`, o `cloudReadyFor`/`cloudHintFor` por provedor e a concatenação de dois catálogos. Se estourar no passo 7, dividir é o passo — não adiar de novo (o próprio `CLAUDE.md` já cobrou isto uma vez para o `preload/index.ts`, R-3).

---

## Verificação

- `pnpm check:fast` depois de cada passo.
- Nível 1: `core/ai/budget.test.ts` (`costed`), `core/ai/models.test.ts` (forma dos dois catálogos), `main/features/ai/providers/gemini.test.ts` (fetch stub).
- Nível 3: `main/features/ai/handlers.test.ts` estendido para `service: 'gemini'` no caminho `blocked`.
- Nível 2: `modelSelection.test.tsx` (affordance, segunda linha, popover), hooks parametrizados cobrindo os três serviços.
- Ao vivo, passo 5 (chave real do `.env`, semeada pelo mecanismo que N-1-A já escreveu — **nunca lida por esta sessão nem pela sessão que executa este plano**): a checagem de múltiplos turnos do Risco 1, depois mensagem de texto simples, streaming real, anexo bloqueado.
- Ao vivo, passo 3: os dois temas, GLM com hover/cursor corretos, popover sem wrap.
- Sem nível 4/5 — mesma razão do N-1-B (chave real não existe em CI).

---

## Diário de execução

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 25/08/2026 | — | plano escrito, ainda não executado | Sessão que seguiu o fechamento de N-1-B e a decisão de trilha (N-1 fecha em Gemini, N-2 nasce depois, sem arquivo). Usuário propôs os dois modelos (`gemini-3.5-flash-lite`, `gemini-3.7-flash`) para cobrir uso diário e raciocínio pesado com uma única chave; pediu o mesmo padrão visual da fileira Locais (contexto, limites, capacidades) para GLM **e** Gemini, a correção da affordance de clique do GLM, e um popover mais largo. As seis skills do projeto invocadas (`architecture`, `ipc`, `design-system`, `testing`, `comments`, `data`) antes de desenhar qualquer decisão. Context7 (obrigatório) mudou o desenho do adaptador: a doc oficial hoje empurra uma API "Interactions" nova e stateful para modelos 3.x, incompatível com o modelo stateless que o resto do app usa — este plano fica deliberadamente no endpoint clássico (`streamGenerateContent`), com a verificação de múltiplos turnos como primeiro sub-passo do passo 5, não uma suposição. Achado fora do que foi pedido, no meio da sessão: a janela de contexto trava em 32.768 tokens para qualquer modelo de nuvem (usuário reportou ao vivo, com captura de tela, o GLM preso nesse número) — rastreado até `contextCeiling` devolvendo `null` para `attention: null` (correto para "não custa RAM", errado para "que teto a barra oferece"), causando um *lock* (D15.13) que congela um número que nunca protegia nada, já que `num_ctx` nunca é enviado a um provedor de nuvem. Corrigido no desenho via `costed` em `conversationWindow` — conversa de nuvem nunca mais entra em `'locked'`, sempre reabre a barra, sem migração de banco. Advisor consultado duas vezes: a primeira definiu a trilha N-1/N-2 (critério: a carta do ROADMAP, não "território desconhecido"); a segunda revisou o desenho inteiro antes deste documento e apontou cinco correções, todas incorporadas — (1) a suposição de endpoint estava sem verificação ao vivo e é a que pode invalidar o plano, virou o primeiro sub-passo do passo 5 em vez de uma premissa silenciosa; (2) `gemini-3.5-flash-lite` tinha evidência mais fraca que `gemini-3.1-flash-lite` numa busca inicial — uma segunda consulta ao Context7 achou a página de modelo dedicada de `gemini-3.5-flash-lite`, confirmando a string original do usuário, sem necessidade de trocar; (3) o fix de `ceilingOf` sozinho não repara conversa **já travada** — motivou o parâmetro `costed` em `conversationWindow`, não só a mudança de teto; (4) o fato de `numCtx` nunca ser enviado à nuvem precisava virar decisão escrita (o medidor de orçamento "decorativo" para nuvem é proposital, não acidente descoberto em QA ao vivo) — registrado em DN1C.2; (5) `rateLimit` não pode ser um trio fixo por causa da concorrência-1 do GLM — virou tipo discriminado, e mora no catálogo de `core/ai/models.ts`, não numa tabela paralela do renderer. Consultas ao Context7 confirmaram: nomes de modelo reais (`gemini-3.5-flash-lite`, `gemini-3.7-flash`, cada um com página própria), `x-goog-api-key` em vez de `Authorization: Bearer`, `thinkingLevel` substituindo `thinkingBudget` para a geração 3.x, contexto de 1M tokens (FAQ da geração 3.5, não confirmado por modelo — Risco 2). |
