# 23-A — O cliente Context7 em `core/`

> Primeiro dos dez cortes do **arco 23** (documentação por REST). Material de entrada, com as 32 decisões já fechadas: [`reference/context7/`](../../reference/context7/README.md) — em especial [`api.md`](../../reference/context7/api.md), que é o anexo deste corte. **Nenhum subcorte:** se este plano crescer demais, ele vira dois irmãos no mesmo nível (23-A e 23-K), nunca um `23-A-1`.

## Contexto

DM-0 trocou a integração com o Context7 de MCP para **REST**: consultar documentação deixa de ser capacidade do modelo e passa a ser operação do aplicativo. Nenhum provedor precisa declarar `tools`, nenhum loop de *tool calling* nasce, e o acionamento é do usuário.

Este corte entrega **só o cliente**: as duas rotas, o parse das duas respostas, a classificação de status e as fixtures gravadas da API real. Nível 1, nada visível, nenhum canal. A fronteira (23-B), a parte persistida (23-C) e o painel (23-D em diante) se apoiam inteiros nos tipos que nascem aqui.

Ele vem primeiro por duas razões que não são de gosto:

- **A cota é finita e já foi mordida.** 200 chamadas/mês no anônimo, e as 13 sondas de 07/09/2026 mais as repetições de controle levaram `Ratelimit-Remaining` de 200 a 157 num único dia. A fase de sonda acontece **uma vez**, gravando fixture, para que nenhuma suíte volte a bater na rede.
- **Seis verificações seguem abertas**, e cada uma pode mudar o formato dos tipos que os outros nove cortes vão consumir. Descobrir depois do 23-D custa retrabalho em cascata.

## Sondagem — o que a leitura encontrou

- **`core/` nunca falou com a rede.** Os três adaptadores de provedor vivem em `main/features/ai/providers/` e usam o `fetch` global; `core/ai/` só conhece os *seams* de `types.ts` (D9.2). Este é o primeiro módulo de `core/` a fazer requisição — e é o que torna D23A.1 uma decisão, não um detalhe.
- **`UpstreamError` já é exatamente o que este cliente precisa lançar** (`core/ai/types.ts`): carrega `status: number | null`, e `mapProviderError` (`main/features/ai/handlers.ts:172`) já o converte em `AppError.upstream`, com o `TypeError` do `fetch` caindo em `unavailable`. O 23-B não escreve classificação nova.
- **`describeUpstreamError` não serve para 400/404 aqui.** Ele trata 401/403/429 com dica própria e cai para mensagem de classe no resto — um `404 no_libraries_found` viraria *"A requisição foi rejeitada pelo serviço (HTTP 404)"*, que é erro de digitação apresentado como falha de sistema.
- **Não existe fixture no repositório.** Todo teste carrega literal inline, e `core/ai/models.test.ts:15` declara a prática: *"model_info as the real Ollama 0.32.6 reported it on 10/08/2026, **trimmed** to …"*. Resposta real, transcrita e aparada, com procedência em comentário.
- **Teste de `core/` que toca disco não é inédito:** `core/export/export.test.ts` escreve e relê arquivo (linhas 142 e 151).
- **`vi.stubGlobal('fetch', …)` é como os três adaptadores testam rede** — mas é do lado de `main/`, onde o `fetch` é global. Com o *seam* injetado o teste nem precisa do global.

## Decisões

### D23A.1 — O cliente mora em `core/`, com o `fetch` injetado

Realiza DM-26. O que mantém a regra de camada intacta é o *seam* de D9.2: a função de rede entra por parâmetro, o módulo não conhece provedor nenhum, e o nível 1 roda sem rede. Em `main/` o cliente ficaria fora da meta de 85% e mais perto do risco de ESM no bundle (DE1D.9).

### D23A.2 — `CONTEXT7_BASE_URL` é constante em `core/`, como default de `baseUrl`

Exceção **nomeada** a DM-20, registrada no fonte. DM-20 descreve adaptadores de provedor (`GLM_ENDPOINT`, `OLLAMA_HOST`, `GEMINI_INTERACTIONS_URL`); aqui não existe adaptador, porque DM-26 pôs o cliente em `core/`. Um literal só no repositório, e sonda ou teste apontam para outro host sem tocar em `main/`.

### D23A.3 — Estado de tela volta; falha de serviço lança

União discriminada para o que a interface desenha; `UpstreamError` para o que é falha. É a régua de `Result` vs exceção da skill [`ipc`](../../../.claude/skills/ipc/SKILL.md) aplicada uma camada antes.

| Situação (tabela dos nove erros, DM-12) | Caminho |
|---|---|
| 2 (`404 no_libraries_found`) · 3 (`200` sem trechos) · 4 (`202` não finalizada) | **retorno** — variante da união |
| 5 · 6 (`429`) · 7 (`401`/`403`) · 8 (`5xx`) | **lança** `UpstreamError` com status |
| 9 (`fetch` rejeita) | propaga o `TypeError` — 23-B mapeia para `unavailable` |
| 1 (campo vazio) | nunca chega ao cliente; o botão desabilitado é o conserto (23-D) |

### D23A.4 — Ordenação total, e o desempate por `id` não basta

`benchmarkScore` decrescente → `id` crescente → `totalSnippets` decrescente → índice original. As duas primeiras chaves bastariam se `id` fosse único, e ele **não é**: `/tanstack/query` volta duas vezes na mesma resposta. A quarta garante ordem total, para que a mesma busca desenhe sempre a mesma tela — a ordem da API varia entre chamadas idênticas.

### D23A.5 — Identidade sintética por resultado

`id` não serve de chave de React nem de identidade de seleção. Cada resultado normalizado ganha uma `key` derivada de `id` + `benchmarkScore` + `totalSnippets` — estável entre renderizações e independente da posição.

### D23A.6 — Sentinela e versões

`stars: -1` vira `null` (é "não se aplica" em todo `/websites/*`, não uma contagem). `versions[]` filtra `__branch__*` e **mantém a ordem crua**: a lista mistura `v5.90.3` com `v5_84_1`, então "mais recente" não é calculável e o cliente não finge que é.

### D23A.7 — `codeId` → URL por tentativa, nunca por formato presumido

`new URL(codeId)` em `try`/`catch`, exigindo `http:`/`https:`; falha vira ausência de link. Os dois formatos são reais — URL completa na sonda de 06/09, id relativo com âncora na documentação oficial — e presumir um quebra no outro.

### D23A.8 — `rules` é parseado e devolvido, não descartado aqui

Corrige a linha *"descarte de `rules`"* da tabela de cortes. DM-17 decidiu **exibir e não enviar**: o descarte acontece em `partForProvider` (23-C) e a aba Regras é do 23-F. O cliente devolve `rules` em campo próprio, nunca fundido aos trechos.

### D23A.9 — Fixtures `.json` verbatim, coladas ao módulo

`src/core/context7/__fixtures__/*.json`, byte a byte. O precedente de `models.test.ts` não se aplica: lá aparar é seguro porque o teste prova **qual chave é lida**; aqui o que se prova são os campos inesperados (`id` repetido, `__branch__*`, `stars: -1`, `searchFilterApplied`) e 4 KB de código com aspas embutidas. O que se preserva do precedente é o cabeçalho de procedência — endpoint, parâmetros, data —, trocando *trimmed* por *verbatim*.

### D23A.10 — Timeout próprio, composto com o signal do chamador

`AbortSignal.any([signal, AbortSignal.timeout(CONTEXT7_TIMEOUT_MS)])`. `fast=false` (DM-18) mantém o reranking por LLM do lado deles, então a chamada é de segundos — sem timeout o painel ficaria preso se o serviço travasse.

### D23A.11 — O texto do 429 sai do cliente, com data real e ciente da chave

`Ratelimit-Reset` chega como epoch (apontou para `2026-10-01T00:00:00Z`) e a mensagem formata **quando a cota volta**, em vez de dizer "limite atingido". As situações 5 e 6 são a mesma resposta HTTP com consertos opostos — sem chave há o que fazer, com chave só esperar —, e o cliente distingue porque sabe se recebeu chave.

## Passos

### 1. Sonda, fixtures e correção do que ela contrariar

Nenhum código de produção. Teto de **~15 chamadas**, gastas nas seis verificações abertas deste corte:

| Verificação | Como |
|---|---|
| `libraryName` vs `query` em `/v2/libs/search` | mesma busca, um parâmetro em cada chamada |
| `/v2/context` consome o mesmo contador? | `Ratelimit-Remaining` antes e depois |
| `id` duplicado acontece no `/v2/context`? | inspecionar resposta com trechos repetidos |
| `fast=true` muda quantidade ou só ordem | mesma pergunta, dois valores |
| `202` na prática, e o enum de `state` | procurar biblioteca não finalizada |
| frequência de `rules`, e em quais bibliotecas | varrer algumas populares |

Grava as fixtures e **corrige `api.md`** onde a sonda contrariar o que está escrito.

### 2. Tipos de fio e o *seam* (`src/core/context7/types.ts`, novo)

Respostas cruas, tipos normalizados, uniões de resultado e `Context7Fetch`. Não reexporta `UpstreamError` — quem precisa importa de `@core/ai/types`.

### 3. Normalização (`src/core/context7/parse.ts` + teste)

D23A.4 a D23A.8, testados contra as fixtures do passo 1.

### 4. Cliente e classificação de status (`src/core/context7/client.ts` + teste)

`searchLibraries` e `fetchContext`: URL com `type=json` explícito (o default da API é `txt`) e `fast=false`, header `Authorization` só quando há chave, timeout composto (D23A.10), o ramo de status inteiro (D23A.3, D23A.11).

### 5. Sincronização de documentação e fechamento

`DECISOES.md` ganha `D23A.1`–`D23A.11`; `api.md` marca as seis verificações como fechadas; o `README.md` do guia marca 23-A como entregue; `ROADMAP § 2` recebe a contagem de testes **remedida**, nunca copiada.

## Verificação

- `pnpm exec vitest related` no arquivo tocado durante o trabalho; `pnpm check:fast` antes de cada commit — o `commit_gate` roda a suíte inteira sozinho.
- **Ver vermelho antes de verde** em dois testes que nasceriam vacuosos: o da ordenação (embaralhar a fixture e exigir a mesma saída — sem a ordenação ele precisa falhar) e o do filtro `__branch__*`.
- **Provar que a suíte não toca a rede:** o `fetchFn` injetado nos testes lança se receber host real.
- `pnpm exec node scripts/check-doc-links.mjs` depois das edições de `docs/`.
- Nada a verificar ao vivo aqui além da própria sonda — o painel é do 23-J.

## Fora do escopo

Canais e handlers (23-B) · chave no cofre e campo em Configurações (23-B) · schema da parte, `docsPartOf`, `partForProvider` (23-C) · painel, gatilho, abas, seleção (23-D em diante) · os textos em português dos nove erros na tela (23-I) · `ESCOPO.md` e o guia antigo marcado `⛔ consumido` (23-J).

## Diário de execução

| Data | O que mudou | Observações |
|---|---|---|
| 07/09/2026 | Plano escrito a partir do guia do arco 23; D23A.1–D23A.11 fixadas | Duas decisões saíram de forquilha explícita: a URL base (DM-26 × DM-20) e a forma das fixtures (o precedente de `models.test.ts` não se aplica) |
| 07/09/2026 | Passo 1: sonda de 11 chamadas, seis fixtures gravadas, `api.md` corrigido | Cinco das seis verificações fechadas; o `202` foi para o 23-I. **Três achados mudam decisão:** `fast=true` devolve 25 trechos contra 3 (não é só ordem), `codeId` endereça a página e não o trecho (a seleção precisa de chave própria — D23A.5 confirmada por medição), e termo sem sentido pode devolver `200` com cinco resultados irrelevantes em vez de `404` |
