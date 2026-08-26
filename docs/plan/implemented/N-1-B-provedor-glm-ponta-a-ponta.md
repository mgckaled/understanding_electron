# N-1-B — GLM ponta a ponta: segundo `AiService`, adaptador de nuvem, recusa de nível 3

**Depende de:** [N-1-A](../implemented/N-1-A-segredo-de-nuvem.md) (sistema de segredo inteiro, `secrets:has`/`secrets:write`/`secrets:remove`, `CLOUD_PROVIDERS`) · D9.2 (`ChatFn` injetável) · D9.3 (gate uniforme `{ kind: 'unavailable', service, hint }`) · D15.9 (por que a nuvem não é "trocar a URL") · [`cloud-optin-implementation-guide.md`](../../reference/cloud-optin-implementation-guide.md) (Peças A–G) · **Entrega:** o app conversa de verdade com `glm-4.7-flash` — segundo valor de `AiService`, adaptador de nuvem com streaming real, `isAvailable` com semântica de nuvem (Peça 9), recusa de nível 3 para anexo de documento/imagem, e a costura mínima do renderer para escolher e usar esse serviço numa conversa.

> Segundo sub-plano da trilha **N** (nuvem) — ver [`ROADMAP § 1`](../../ROADMAP.md#1-a-sequência). N-1-A fechou a Peça A (segredo) por inteiro; este plano consome esse sistema e fecha as Peças B, C, D e G do guia **só para o GLM**. **N-1-C** (Gemini + cota/limite de taxa, Peça E, e possivelmente Peça F) segue sem arquivo — nasce quando for o próximo a executar, mesma regra do arco 13-23.

**Fora deste plano — decidido nesta sessão, com o advisor:**

- **Gemini inteiro.** Fica para N-1-C. Motivo: só o GLM é texto-puro — a tensão nível-3/visão da Peça D (`ESCOPO.md`, "sem solução") nunca se abre; o tier grátis do GLM não tem a ressalva de uso do prompt para treino que o do Gemini tem; e o formato do chunk do endpoint clássico do Gemini (`streamGenerateContent`) **não está confirmado** (Peça G) — decidir por Gemini agora custaria uma segunda rodada de Context7 antes de desenhar o parser. Escolha confirmada pelo usuário nesta sessão, com os dois lados do trade-off postos lado a lado.
- **Cota e limite de taxa (Peça E).** A concorrência-1 do GLM não é contada nem enfileirada pelo app — uma segunda chamada simultânea simplesmente estoura como um `upstream` qualquer, o mesmo tratamento genérico que Ollama já recebe para um HTTP não-2xx. Fica para N-1-C, junto do Gemini (que tem o problema simétrico: RPD, não concorrência).
- **Peça F (elegíveis via Groq/Cerebras/SambaNova).** Não tocada.
- **Desabilitar o botão de anexo quando um modelo de nuvem está selecionado.** A recusa em `chat()` (DN1B.6) é a fronteira de correção; greyar o botão **antes** de tentar é cortesia, não correção (`ESCOPO.md`: "o gate de capacidade é correção, não cortesia" — lido aqui como "a recusa precisa existir", não como "a antecipação também precisa"). Pode entrar depois, sem custo de retrofit: `isCloudService` (DN1B.6) já é a função que a decidiria.
- **Uma chamada de validação real ao gravar a chave GLM.** Peça 9 já registra as duas saídas possíveis; este plano fica com a mais simples — "disponível" na nuvem significa "há uma chave gravada", e uma chave inválida se descobre no primeiro envio real, com erro claro (`upstream`). Revisitar se a UX disso incomodar.
- **Tornar `ceilingOf`/`BudgetMeter` "cientes de nuvem".** Já degradam corretamente sem nenhuma linha nova: `attention: null` (DN1B.2) faz `contextCeiling` devolver `null`, e `fitsInMemory(null)` é `true` — nunca aparece "não cabe" para um modelo que não tem custo de RAM. Não é lacuna, é o comportamento certo já existente. **Ressalva que a execução provou necessária:** isto vale para as duas funções em si, não para o que alimenta `current` — a fusão de catálogos (`allModels`) que decide QUAL modelo chega até `ceilingOf` precisou de correção real (a corrida de tempo do diário de 22/08/2026, DN1B.7). O que ficou fora deste plano é lógica nova dentro de `ceilingOf`/`BudgetMeter`; a fiação que os alimenta sempre esteve dentro.

---

## Contexto

O guia ([`cloud-optin-implementation-guide.md`](../../reference/cloud-optin-implementation-guide.md)) já tinha mapeado a maior parte do que muda na arquitetura antes deste plano começar — Peças B (plumbing de provedor), C (tabela de capacidade chumbada), D (tensão nível-3/visão), G (streaming não é um padrão único) e a seção 9 (`isAvailable` muda de sentido na nuvem). Este plano fecha essas peças **só para o GLM**, e resolve ao vivo, nesta sessão, a única lacuna que o guia deixou em aberto para ele: a Peça G não tinha pesquisado o formato de streaming do GLM — só Ollama, Groq, Cerebras/SambaNova e Gemini.

**Pesquisa desta sessão (Context7, obrigatória), resolvendo a lacuna:** a documentação oficial (`docs.z.ai`, via Context7) confirma o endpoint `POST https://api.z.ai/api/paas/v4/chat/completions`, autenticação `Authorization: Bearer <chave>`, e streaming em **Server-Sent Events no formato compatível com OpenAI** — `data: {"choices":[{"delta":{"content":"..."},"finish_reason":null}]}` por linha, a última linha carregando `finish_reason` mais `usage: {prompt_tokens, completion_tokens, total_tokens}`, terminado por `data: [DONE]`. **Achado extra, fora do que a pesquisa pretendia confirmar:** o mill.tools (projeto irmão, mesmo desenvolvedor) já roda `glm-4.7-flash` em produção via `langchain_openai.ChatOpenAI` apontado para essa mesma `base_url` (`src/llm_factory.py:259-267`) — corrobora, com uso real, que o endpoint é genuinamente compatível com OpenAI, não só "parece ser" pela doc. O parâmetro `thinking: { type: 'enabled' | 'disabled' }` também está confirmado (default `'enabled'`).

**Por que GLM primeiro, não Gemini** — pergunta feita ao usuário nesta sessão, com os dois lados concretos: GLM é texto-puro (a tensão nível-3/visão do Gemini nunca se abre), seu tier grátis não usa o prompt para treinar (o do Gemini usa), e seu formato de streaming ficou confirmado nesta sessão tanto pela doc oficial quanto pelo uso real do mill.tools. O Gemini continua sendo o motivo real de querer nuvem (1M de contexto), mas isso é histórico de N-1-C, não deste plano.

**O que N-1-A deixou pronto e este plano só consome:** `secrets:has('glm')`/`secrets:write`/`secrets:remove` já funcionam; a tabela `secrets` já tem uma linha possível para `'glm'`; o campo de dois estados no modal de Configurações já grava a chave. **Nada disso muda aqui.** O que falta é só o lado que N-1-A explicitamente deixou de fora: "decifrar para usar numa chamada real é trabalho do N-1-B, no ponto em que a chamada HTTP é montada" (DN1A.3).

**O achado de leitura de código mais importante desta sessão** (não de doc): `register-all.ts` já teoriza o próprio trabalho deste plano — o comentário ao lado de `handle('ai:isAvailable', ...)` diz, desde N-1-A ou antes, *"Single provider in step 1 — the args.service enum admits only 'ollama'. Step 3 (cloud opt-in) replaces the fixed adapters with a service→provider resolver; nothing else in this file changes"*. E confere: `main/features/ai/handlers.ts` (`isAvailable`, `models`, `loaded`, `unload`, `chat`) já recebe a função do provedor como parâmetro injetado — nenhuma delas contém lógica específica do Ollama. **Um provedor de nuvem novo é resolver qual adaptador passar, não reescrever o handler.**

**Achado que define o desenho da UI:** o app inteiro está hoje hardcoded em `'ollama'` em três lugares do renderer — `useAiModels`, `useAiAvailability` (`const SERVICE = 'ollama' as const`) e `useConversationChat` (idem). E o composer só envia quando `isReady` (de `useAiAvailability()`) é verdadeiro — **se isso ficasse ligado só ao Ollama, escolher GLM com o Ollama fora do ar deixaria o composer travado para um serviço que não tem nada a ver com o problema.** Por isso DN1B.7 generaliza esses três hooks por `service`, e não só o backend.

**Achado que evita uma migração:** `conversationSettingsSchema` já vive numa coluna JSON (`json_patch`, D14.1) com o comentário explícito *"Every field optional by design... a conversation predating a setting needs no migration"*. Acrescentar `service` é a mesma jogada que `numCtx` já fez — zero `CREATE TABLE`, zero backfill; ausência já significa "o padrão", que continua sendo Ollama.

---

## Decisões

### DN1B.1 — Segundo valor de `AiService`

```ts
// src/shared/ipc.ts
export const aiServiceSchema = z.enum(['ollama', 'glm'])
```

É a costura que D15.9/Peça B previu como "uma linha depois, cinco lugares antes" — hoje ela se paga. `CLOUD_PROVIDERS` (`['gemini', 'glm']`, N-1-A) continua **separado** e mais largo: ele nomeia com quem o app tem uma chave, não com quem o app conversa hoje. `'gemini'` segue elegível como `CloudProvider` (a chave já pode ser gravada em Configurações) sem ainda ser um `AiService` — a distinção que já existia se prova útil aqui, sem precisar de ajuste.

`conversationSettingsSchema` ganha `service: aiServiceSchema.optional()`, mesmo padrão de `numCtx`: ausente significa Ollama, nenhuma conversa gravada antes deste plano muda de comportamento.

### DN1B.2 — Tabela chumbada (Peça C), fileira própria no seletor

```ts
// src/core/ai/models.ts
export const GLM_MODELS: AiModel[] = [
  {
    provider: 'glm',
    name: 'glm-4.7-flash',
    parameterSize: '31B',
    sizeBytes: 0,
    capabilities: ['completion', 'tools', 'thinking'],
    contextLength: 200_000,
    attention: null,
    variantOf: null
  }
]
```

`capabilities` inclui `'completion'` de propósito — `selectableModels()` (`conversations.ts`, D15.11) filtra por essa capacidade antes de tudo; esquecê-la faria o GLM desaparecer da lista em silêncio, com todo teste de nível 1 passando (a mesma classe de defeito que D15.11 já documentou uma vez). `sizeBytes: 0` e `attention: null` não são gambiarra: `contextCeiling(model, ...)` já devolve `null` para um modelo sem `attention` (mesma rota que um embedder usa), e `fitsInMemory(null)` já é `true` — nenhuma linha nova em `core/ai/budget.ts` ou `memory.ts`.

**A fileira "Nuvem (Opt-in)" do `ModelSelector` não vira uma segunda cópia da fileira local.** A fileira local mostra tamanho e teto de contexto porque os dois custam RAM desta máquina; nenhum dos dois significa nada para um modelo que não roda aqui. Reaproveitar a mesma marcação mostraria "0 B" — dado verdadeiro, leitura errada. A fileira de nuvem continua sendo a sua própria fileira, só que agora orientada por dado real (`useAiModels('glm')`/`useAiAvailability('glm')`, DN1B.7) em vez do array estático `CLOUD_MODELS` de hoje.

### DN1B.3 — Adaptador GLM: fetch cru, sem SDK

`main/features/ai/providers/glm.ts`, mesmo formato de `ollama.ts` (`ProbeFn`/`ModelsFn`/`LoadedFn`/`UnloadFn`/`ChatFn`) — nenhuma dependência nova. O mill.tools usa LangChain (`ChatOpenAI`); o crivo não usa LangChain em lugar nenhum e o adaptador Ollama já prova que `fetch` cru + parser de SSE/NDJSON funciona bem aqui — introduzir um SDK para um segundo provedor quebraria "uma variável por vez" sem necessidade.

```ts
const GLM_ENDPOINT = 'https://api.z.ai/api/paas/v4/chat/completions'

// hasKey, não getApiKey: a sonda só precisa responder "há chave?" (Peça 9),
// nunca decifrar — reaproveita hasSecret (N-1-A), sem abrir o BLOB à toa a
// cada montagem de card/retry.
export function makeGlmProbe(hasKey: () => boolean): ProbeFn {
  return async () => {
    if (!hasKey()) throw new UpstreamError(null, 'no api key stored')
    return 'glm-4.7-flash' // no version to report — Peça 9: disponível = chave gravada
  }
}

export function makeGlmChat(getApiKey: () => string | null): ChatFn {
  return async (messages, { model, signal, onChunk }) => {
    const apiKey = getApiKey()
    if (apiKey === null) throw new UpstreamError(null, 'no api key stored')
    const response = await fetch(GLM_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        // O `model` que o chamador passou, nunca um literal — é exatamente o
        // payoff que DN1A.5 registrou: um segundo modelo do mesmo provedor não
        // pede tela de credencial nova, só um `model` diferente aqui.
        model,
        messages,
        stream: true,
        // Mesmo stopgap do qwen3:4b em ollama.ts: o parser não lê
        // delta.reasoning_content, então pensamento vira latência sem virar
        // texto. Revisitar junto (planos 21-23).
        thinking: { type: 'disabled' }
      }),
      signal
    })
    // parse SSE: linhas "data: {...}", ignorar linhas em branco, parar em "data: [DONE]"
  }
}

export const glmLoaded: LoadedFn = async () => [] // nada residente a reportar (core/ai/types.ts já documenta isto)
export const glmUnload: UnloadFn = async () => {} // no-op, mesmo motivo
export const glmModels: ModelsFn = async () => GLM_MODELS // tabela chumbada, zero rede (Peça C)
```

`makeGlmProbe`/`makeGlmChat` são **fábricas**, não funções fixas como as de `ollama.ts` — cada uma pede uma dependência diferente, injetada por quem monta o adaptador (`register-all.ts`), mesma DIP que `ChatFn`/`embed_fn` já usam em todo o resto do app: a sonda só precisa saber SE há chave (`hasKey`, reaproveitando `hasSecret` de N-1-A — barato, sem decifrar), a chamada real precisa da chave decifrada (`getApiKey`, DN1B.4 — só ela paga o custo de abrir o `safeStorage`).

### DN1B.4 — Decifrar no ponto de montagem da chamada, nunca em `secrets/handlers.ts`

N-1-A deixou o comentário explícito: *"Decrypting for a real API call is N-1-B's job, at the point it builds one"* — e o motivo de **não** ser em `secrets/handlers.ts` é manter verdadeiro o comentário que já está lá (*"decryptString has no counterpart here on purpose"*). Novo arquivo, sem canal IPC (a regra de mão única é sobre a superfície que o renderer alcança — código só do main já tem acesso total ao banco, por definição):

```ts
// src/main/features/secrets/read.ts
export type DecryptFn = (ciphertext: Uint8Array) => string

export function readSecretForUse(
  provider: CloudProvider,
  db: DatabaseSync,
  decrypt: DecryptFn
): string | null {
  const row = db.prepare('SELECT ciphertext FROM secrets WHERE provider = ?').get(provider) as
    | { ciphertext: Uint8Array }
    | undefined
  return row === undefined ? null : decrypt(row.ciphertext)
}
```

`register-all.ts` ganha `decryptSecret` ao lado do `encryptSecret` que N-1-A já escreveu — mesma forma (`safeStorage.decryptString(...)` chamado de dentro do corpo de uma função normal, não passado como referência solta), evitando de propósito o "Illegal invocation" que N-1-A só pegou ao vivo. `getGlmApiKey = () => readSecretForUse('glm', db, decryptSecret)` entra só em `makeGlmChat` (DN1B.3) — `makeGlmProbe` recebe `() => hasSecret({ provider: 'glm' }, db)` (N-1-A, sem decifrar nada).

### DN1B.5 — `register-all.ts` vira o resolver que o próprio arquivo já previa

```ts
type ProviderAdapter = {
  probe: ProbeFn
  models: ModelsFn
  loaded: LoadedFn
  unload: UnloadFn
  chat: ChatFn
  host?: string
}

function resolveProvider(service: AiService, glmAdapter: ProviderAdapter): ProviderAdapter {
  return service === 'glm' ? glmAdapter : ollamaAdapter
}
```

Cada `handle('ai:*', ...)` passa a resolver por `args.service` em vez de fechar sobre a função fixa do Ollama. **`main/features/ai/handlers.ts` não muda a lógica de nenhuma das cinco funções** (`isAvailable`, `models`, `loaded`, `unload`, `chat` já recebem a função do provedor injetada) — mas `HINTS: Record<AiService, string>` (linha 32 do arquivo) é um mapa exaustivo por `AiService`, e `pnpm typecheck` reprova assim que `aiServiceSchema` ganha `'glm'` (DN1B.1) sem que `HINTS.glm` exista. **Por isso `HINTS.glm` entra no passo 1, não aqui** — mesma lição que N-1-A já pagou uma vez com `preload/index.ts`/`test/api-mock.ts` tendo que migrar de passo por causa de um tipo exato que o compilador exige assim que o contrato muda. Grep por `Record<AiService` antes de fechar o passo 1 é o jeito de não redescobrir isso na hora.

### DN1B.6 — Recusa de nível 3: reaproveita `AppError.kind === 'blocked'`, não inventa um novo

`ESCOPO.md` já resolve isto por texto — *"nível 3... bloqueado na nuvem, com a mesma dica acionável do gate de disponibilidade... nenhum mecanismo novo, a mesma porta"* — e o grep desta sessão achou a porta: `{ kind: 'blocked'; reason: string }` já existe em `AppError` e já é o formato usado quando o app **examina uma entrada e recusa por política/estrutura** (PDF sem texto selecionável, formato de imagem não reconhecido, coluna aninhada em Excel/JSON) — semanticamente mais correto que `'unavailable'` (que quer dizer "o serviço não responde", não "este anexo não é permitido aqui"). `errorMessage()` no renderer já sabe mostrar `reason` verbatim.

```ts
// src/core/ai/messages.ts — mesmo arquivo que já hospeda a fronteira de três níveis
export function isCloudService(service: AiService): boolean {
  return service !== 'ollama'
}

export function checkLevel3(messages: Message[], service: AiService): AppError | null {
  if (!isCloudService(service)) return null
  const hasRestrictedPart = messages.some((m) =>
    m.parts.some((p) => p.kind === 'document' || p.kind === 'image')
  )
  return hasRestrictedPart
    ? {
        kind: 'blocked',
        reason:
          'Documento e imagem são nível 3 — bloqueados em modelos de nuvem. Use um modelo local para este anexo.'
      }
    : null
}
```

`chat()` (`main/features/ai/handlers.ts`) chama `checkLevel3` **antes** de `jobs.create(jobId)` — uma recusa não abre job, não cria timeout, não passa pelo `runChat`. Fica em `core/ai/messages.ts`, não dentro do handler, pela mesma razão que o cabeçalho do arquivo já registra: "a decisão que dois chamadores precisam mora em `core/`, ou validação ao lado de um vira bypass no segundo" — o plano 19 (propor: consulta e passos) é o segundo chamador previsível.

### DN1B.7 — A costura do renderer é só o que enviar-uma-mensagem-ao-GLM exige

Generalização mínima, três hooks, um campo de settings — nada de painel de administração de provedor. **A parte que não é só plumbing, achada ao revisar a expressão inteira do gate do composer** (`disabled={!isReady || model === null || numCtx === null}`, `ConversationView.tsx`): os três termos leem de fontes hoje Ollama-only, não só o primeiro.

- `useAiAvailability(service: AiService)` e `useAiModels(service: AiService)` — o `const SERVICE = 'ollama' as const` interno vira parâmetro. Cada chamador escolhe o serviço; nenhum dos dois ganha lógica nova.
- `useConversationChat` recebe `service` (ao lado de `model`), manda `{ service, model, ... }` para `window.api.ai.chat`, e escreve `service` no par travado do primeiro envio — mesma disciplina "grava só o que falta" que `model`/`numCtx` já seguem (D15.13).
- **`resolveModel(chosen.model, installed, locked)` precisa do catálogo UNIDO, não só do Ollama** — achado ao ler a função: quando `chosen` não está em `catalog`, ela devolve `null` se `locked` (uma conversa GLM já travada ficaria com o composer sem modelo algum ao recarregar) ou o primeiro modelo Ollama se não estiver (escolher GLM antes do primeiro envio seria silenciosamente revertido para Ollama). `ConversationView` monta `allModels = [...ollamaModels, ...glmModels]` e alimenta **esse** array em `resolveModel` e em `current = allModels.find((m) => m.name === model)` — `ceilingOf`/`contextCeiling` já tratam `attention: null` como "sem custo de RAM" (`ceiling: null` → `fitsInMemory`/`conversationWindow` já resolvem para uma janela aberta, DN1B.2), então nenhuma mudança extra é necessária ali além de alimentar a lista certa.
- `ConversationView` resolve `service` do jeito que já resolve `model` — `chosen.service ?? 'ollama'` — e passa esse valor para `useAiAvailability`, para `useConversationChat` e para o `ModelPicker`. **`isReady` passa a refletir o serviço selecionado, não sempre o Ollama** — sem isso, escolher GLM com o Ollama fora do ar deixaria o composer travado por um motivo que não é dele. O texto "Verificando o Ollama…" (linha do estado `loading`) também precisa deixar de ser literal — vira algo como `Verificando ${serviceLabel}…`, ou passa a existir só quando `service === 'ollama'`.
- `ModelPicker` ganha um segundo par de props para a fileira de nuvem (ex.: `cloudState: ViewState<AiModel[]>`, mais o hint de quando desabilitado) — hoje só recebe um `state`/`onSelect(name)` para a fileira local. **`onSelect` continua com a MESMA assinatura** (`(name: string) => void`); é o chamador (`ConversationView`) quem descobre o serviço, procurando `name` em `allModels` (`.find((m) => m.name === name)?.provider`) e escrevendo `{ model: name, service }` num único `choose(...)` — evita mudar a assinatura do callback só para carregar um segundo valor.
- `ModelSelector`: a fileira "Nuvem (Opt-in)" troca o array estático `CLOUD_MODELS` pela entrada real de `useAiModels('glm')`, habilitada quando `useAiAvailability('glm').state.status === 'ready'` — clicável de verdade quando há chave, com o mesmo texto de dica (`HINTS.glm`) quando não há. Continua sendo sua própria fileira (DN1B.2), não a mesma linha visual do catálogo local.
- `test/api-mock.ts` precisa responder `isAvailable`/`models` para os dois serviços — os testes de nível 2 do passo 5/6 chamam os hooks com `'glm'`, e o mock atual só sabe responder pelo argumento que recebe (não é um novo canal, é o mesmo mock cobrindo um segundo valor de argumento).

---

## Passos

| # | Entrega | Testes | Aceite |
|---|---|---|---|
| **1** | `shared/ipc.ts`: `aiServiceSchema` ganha `'glm'` (DN1B.1); `conversationSettingsSchema` ganha `service` opcional. `main/features/ai/handlers.ts`: `HINTS.glm` — movido para cá porque `Record<AiService, string>` é exaustivo e `pnpm typecheck` reprova assim que `aiServiceSchema` ganhar `'glm'` sem essa entrada (lição de N-1-A) | Nível 1: `argsSchema`/`conversationSettingsSchema` aceitam `service: 'glm'`; `aiServiceSchema.parse('gemini')` continua rejeitando | `pnpm typecheck` verde nos dois projetos; grep por `Record<AiService` confirma que `HINTS` é o único mapa exaustivo a atualizar nesta mudança; nenhuma mudança de assinatura em `Api`, então preload/`api-mock.ts` compilam sem tocar |
| **2** | `core/ai/models.ts`: `GLM_MODELS` (DN1B.2). `core/ai/messages.ts`: `isCloudService`/`checkLevel3` (DN1B.6) | Nível 1: forma de `GLM_MODELS[0]` (`capabilities` inclui `'completion'`); `checkLevel3` — bloqueia doc/imagem só quando `service !== 'ollama'`, deixa texto/dataset passar sempre | 85%+ de linha nos dois arquivos; nenhum import de `electron` |
| **3** | `main/features/secrets/read.ts` (`readSecretForUse`, DN1B.4); `main/features/ai/providers/glm.ts` (adaptador completo, DN1B.3) | Nível 1: `readSecretForUse` contra `:memory:`, `decrypt` injetado como fake, cobrindo achar/não achar linha. Adaptador: mesmo padrão de fetch stub que `ollama.test.ts` já usa (`vi.stubGlobal('fetch', ...)`) — `makeGlmChat` monta o header `authorization` certo, usa o `model` recebido (nunca um literal), parseia SSE multi-linha (inclui uma linha partida entre dois chunks, mesmo teste que `ollama.test.ts` já faz para NDJSON), lê `usage` da última linha, para em `[DONE]`; `makeGlmProbe` lança quando `hasKey()` é `false` sem chamar `fetch`; `makeGlmChat` lança quando `getApiKey()` é `null`, idem | `pnpm check:fast` verde; grep por `decryptString` confirma que só aparece em `register-all.ts` — `read.ts` e `glm.ts` recebem a chave já decifrada, nunca chamam `safeStorage` |
| **4** | `register-all.ts`: `decryptSecret`, `resolveProvider`, os cinco `handle('ai:*', ...)` resolvendo por `args.service` (DN1B.5). `main/features/ai/handlers.ts`: `chat()` chama `checkLevel3` antes de `jobs.create` | Nível 3: `handlers.test.ts` estendido — `chat()` com `service: 'glm'` e uma `MessagePart` de `document`/`image` devolve `{ kind: 'blocked' }` sem que `chatFn`/`jobs.create` sejam chamados; com só `text`/`dataset`, segue normal | `pnpm check:fast` verde; `pnpm dev` sobe sem exceção não tratada (checagem rápida antes do passo 6, que é quem prova a chamada real) |
| **5** | Renderer, parte 1 (sem UI nova): `useAiAvailability(service)`, `useAiModels(service)`, `useConversationChat` recebendo/enviando/travando `service`; `test/api-mock.ts` respondendo pelos dois serviços (DN1B.7) | Nível 2: os dois hooks parametrizados continuam passando com `'ollama'` (nenhuma regressão); um teste novo com `service: 'glm'` confirma que o par travado grava `service` junto de `model` no primeiro envio | `pnpm check:fast` verde; testes existentes de `modelSelection.test.tsx`/`contextBudget.test.tsx` inalterados no comportamento Ollama |
| **6** | Renderer, parte 2 (UI): `ConversationView` montando `allModels` (união dos dois catálogos) e alimentando `resolveModel`/`current` com ele, `isReady`/label de "Verificando…" por serviço selecionado; `ModelPicker` com o segundo par de props e a fileira de nuvem real, `onSelect` derivando `service` por busca em `allModels` (DN1B.7) | Nível 2: `ModelPicker` mostra o GLM clicável quando `useAiAvailability('glm')` está `ready`, desabilitado com a dica quando não está; **regressão do achado do advisor** — escolher GLM antes do primeiro envio não reverte para o primeiro modelo Ollama, e uma conversa GLM já travada resolve `model` normalmente ao recarregar (não fica `null`) | Verificado ao vivo (`pnpm dev`, os dois temas): selecionar GLM, mandar uma mensagem de texto e receber streaming real; anexar documento/imagem com GLM selecionado e ver a recusa `blocked`; derrubar o Ollama e confirmar que o composer permanece habilitado para uma conversa em GLM |
| **7** | Fechamento: diário preenchido; candidatos a `HISTORY.md` — a Peça G do GLM resolvida por Context7 **e** corroborada pelo mill.tools em produção, o reaproveitamento de `'blocked'` para nível 3 em vez de um `kind` novo, o resolver de `register-all.ts` que o próprio comentário do arquivo já previa; `ROADMAP.md` marca N-1-B concluído, abre N-1-C (Gemini + cota) | — | `pnpm check:fast` verde; nenhum canal IPC novo nasceu neste plano, então a tabela de domínios da skill `ipc` não muda — conferir antes de fechar, não presumir |

---

## Ordem de dependência

```
1 (contrato) ──► 2 (core puro) ──► 3 (secrets/read + adaptador) ──► 4 (resolver + gate no handler) ──► 5 (hooks) ──► 6 (UI) ──► 7 (fechamento)
```

Estritamente sequencial, mais linear que N-1-A: cada passo depende do anterior existir para compilar (o resolver do passo 4 precisa do adaptador do passo 3; os hooks do passo 5 precisam do canal já aceitar `'glm'` desde o passo 1).

---

## Riscos

1. **`node:sqlite` devolvendo `Uint8Array` de um `SELECT` sobre coluna `BLOB`** — DN1A.2 confirmou (via Context7) que a gravação aceita `Buffer`/`TypedArray`; a **leitura** (`readSecretForUse`, que só `makeGlmChat` usa — a sonda usa `hasSecret`, que não lê o BLOB) nunca foi exercitada. `safeStorage.decryptString` espera um `Buffer`; `Buffer.from(uint8ArrayLido)` deveria bastar (Buffer é subclasse de `Uint8Array`), mas isto é julgamento sobre doc, não medição — o passo 3 prova ao vivo, mesma disciplina do Risco 3 de N-1-A.
2. **Corpo de erro não-2xx do GLM não foi pesquisado** — só o caminho feliz do streaming foi confirmado via Context7 nesta sessão. O adaptador trata qualquer status não-OK genericamente (`UpstreamError(status, 'HTTP ' + status)`), igual ao Ollama — aceitável para abrir o provedor, mas a mensagem que chega à UI num 401 (chave inválida) ou 429 (cota) não vem do corpo real do erro, só do código HTTP.
3. **Concorrência-1 do GLM não é imposta pelo app** (decisão DN1B, fora deste plano) — um segundo envio simultâneo ao mesmo provedor (hoje improvável, já que o composer trava durante o envio; mas um consumidor futuro como o plano 19 poderia mudar isso) estoura como `upstream` sem fila nem retry.
4. **`thinking: { type: 'disabled' }` não foi reconfirmado especificamente para `glm-4.7-flash`** — os exemplos da doc usam `glm-4.7` (sem `-flash`). Pior caso se o parâmetro não for honrado: raciocínio vaza como latência sem aparecer no texto, o mesmo estado em que `qwen3:4b` já vive no Ollama — não é regressão nova, é o mesmo estopgap adiado para os planos 21-23.
5. **Uma conversa criada antes deste plano não tem `service` no JSON de settings** — `chosen.service ?? 'ollama'` é o default, e é o comportamento que ela já tinha. Baixo risco, mas é o primeiro lugar a olhar se uma conversa antiga parecer endereçada ao provedor errado depois deste plano.

---

## Verificação

- `pnpm check:fast` depois de cada passo.
- Nível 1: `core/ai/models.test.ts`, `core/ai/messages.test.ts`, `main/features/secrets/read.test.ts`, `main/features/ai/providers/glm.test.ts` (fetch stub, sem Electron real).
- Nível 3: `main/features/ai/handlers.test.ts` estendido para o caminho `blocked` de `chat()`.
- Nível 2: os hooks parametrizados e o `ModelSelector` com a fileira de nuvem, `window.api` mockado via `test/api-mock.ts`.
- Ao vivo (passo 6, com a chave real que já está no `.env` — **nunca lida ou aberta por esta sessão**, só usada pela semente que N-1-A já escreveu): `pnpm dev`, os dois temas, mensagem de texto simples, tentativa de anexo bloqueada, Ollama fora do ar com GLM selecionado.
- Sem nível 4/5 neste plano — um e2e "conversar com GLM" pede uma chave real disponível no ambiente de CI, que não existe; a verificação ao vivo do passo 6 é o que prova a integração de ponta a ponta nesta sessão.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 22/08/2026 | 1–7 | plano executado por inteiro | Passos 5 e 6 **se fundiram na prática**: mudar a assinatura dos três hooks quebra todo chamador de imediato, então não houve como fechar "só os hooks" sem tocar os componentes na mesma leva — registrado, não fingido como dois passos. Achado arquitetural deliberado: o `ModelPicker` apagava o `button` gatilho inteiro quando o catálogo Ollama falhava, o que tornaria **inalcançável** selecionar nuvem justamente quando o Ollama está fora do ar — contradizendo o próprio aceite do passo 6. Restruturado para o gatilho e a fileira de Nuvem renderizarem sempre; três testes que assumiam o comportamento antigo foram **reescritos para provar o novo**, não ajustados para passar. |
| 21/08/2026 | — | plano escrito | Usuário escolheu GLM sobre Gemini com os dois lados do trade-off à vista. Context7 confirmou o endpoint; achado extra fora do escopo da busca — o mill.tools já roda o mesmo modelo em produção pela mesma `base_url`, corroborando o formato com uso real. A segunda rodada do advisor achou quatro problemas no documento já escrito, entre eles que `resolveModel` só via o catálogo Ollama: uma conversa de nuvem travada resolveria `model: null` ao recarregar, e uma escolhida-mas-não-travada seria revertida em silêncio. |

**O que este plano deixou fora dele:**

| Achado | Dono |
|---|---|
| Catálogo síncrono concatenado com assíncrono vence o índice 0 e o fallback escolhe nuvem por acidente de tempo | [`ARMADILHAS.md`](../../ARMADILHAS.md) |
| Asserção por texto curto casa com substring de outro elemento (`/ok/i` bateu em "tokens") | [`ARMADILHAS.md`](../../ARMADILHAS.md) |
| Mensagem de erro upstream classificada por status HTTP | [`HISTORY.md`](../../HISTORY.md) |
| Decisões DN1B.1 em diante | [`DECISOES.md`](../../DECISOES.md) |

⚠️ **Ressalva de verificação, registrada em vez de arredondada:** a captura rotulada "tema escuro" **não** aparentava tema escuro (fundo claro atrás do backdrop) — provável alternador ainda não assentado no momento do screenshot. A fileira ficou legível nas duas capturas, mas só uma foi genuinamente dark-mode; não vale ler como "verificado nos dois temas".