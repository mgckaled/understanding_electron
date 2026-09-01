# O-2 — IPC, jobs e a fila do worker: o risco documentado vira mostrador

> Segundo plano da trilha O. A fundamentação inteira — os seis eixos, a classificação de custo/trabalho/situação, o critério `crivo.db` vs. `observatory.db` — é de [`docs/reference/observatory/`](../../reference/observatory/README.md). Este plano **não a repete: aplica**. Toda referência a "§ n" abaixo é seção daquele documento.

**Origem:** o [`O-1`](O-1-a-casca-do-observatorio.md) entregou a casca (modal, `panels.ts`, `Dialog` largo) e os dois painéis **Grátis** que só liam estado já servido por canal existente. Este plano é o segundo corte da mesma fila (§ 6 da fundamentação): três fontes **Grátis/Moderado**, já `Disponível`, que pedem canal novo mas nenhuma persistência. A escolha do corte foi revisada em sessão de análise de um relatório externo ([`notes/observatory/report.md`](../../../notes/observatory/report.md)) — a avaliação (registrada nesta conversa, não em arquivo próprio, porque o relatório em si não é dono de fato nenhum do projeto) confirmou a tese central, apontou um erro factual nele (o risco do worker morto **não** foi corrigido — ver sondagem abaixo) e validou IPC/Jobs/fila como o próximo corte de maior retorno.

**Entrega:** um canal por fonte (`app:ipcStats`, `job:list`, `dataset:queueDepth`), um núcleo puro para os contadores de IPC, e **um** painel novo — não três — agregando as três leituras.

---

## O que a sondagem achou, e que o desenho não previa

Leitura do fonte (`src/main/jobs.ts`, `src/main/ipc/registry.ts`, `src/main/duckdb/spawnWorker.ts`) e Context7 (TanStack Query) em 31/08/2026:

| Afirmação plausível | O que é verdade |
| --- | --- |
| O painel de fila do worker é conveniência de debug | ⚠️ **Não — é risco real e sem conserto.** `ARMADILHAS.md` (linha 112) registra: um worker morto no meio da fila deixa toda chamada seguinte pendurada, sem resposta nem erro. Não é "descoberto e corrigido" — o relatório externo errou nisso. E piorou: a pré-visualização automática do 18-C tornou "duas consultas na mesma fila" o caso comum, não mais o raro |
| Contar toda chamada de IPC é instrumentação em caminho quente, deveria ser `Pesado` | Não — a própria fundamentação (§ 6) já classifica como `Moderado`: `performance.now()` + escrita num `Map` é O(1) contra uma fronteira de processo que já copia o payload inteiro (skill `ipc`). Não é decisão nova desta sessão, é conferência do que já estava classificado |
| TanStack Query resolveria a atualização "ao vivo" do painel com polling automático | Existe (`refetchInterval` como função, parando com `return false` — Context7, `tanstack/query`), mas **rejeitado aqui**: § 4.5 da fundamentação avisa que um painel que vira "acompanhar" deveria sair do modal, não ganhar `setInterval`. `staleTime: 0` sem `refetchInterval` já é o padrão do `ProcessesPanel` do O-1, e cobre o caso — reabrir o painel relê |
| Cada fonte nova é um painel novo na sidebar | Não necessariamente. As três cabem num painel só — é o precedente do próprio mill.tools (§ 1.1: a aba `Status` empilha 6 blocos independentes) e a resposta direta ao risco de crescimento horizontal que o relatório aponta em si mesmo (§ 24 dele) |
| `jobs.ts` já expõe o suficiente | Não — só `create`/`cancel`/`finish`. Falta um `list()` que devolva as chaves do `Map` |
| `createEnqueue` (fila do worker) já conta profundidade | Não — só a `tail` promise encadeada. Nenhum contador existe hoje |
| Validação de payload (zod) deveria contar como falha do canal nos contadores | Decisão, não fato: ver DO2.8 |

---

## Decisões

### DO2.1 — Um painel, três blocos — não três entradas na sidebar

IPC, jobs e fila do worker são a mesma categoria de coisa: sinal de atividade interna, lido agora, sem história. Um painel _Em andamento_ com três seções cobre as três fontes. Evita o crescimento "O-2 → +3 painéis" que o próprio material de origem identifica como o maior risco da trilha inteira — o Observatório cresce em profundidade dentro de um painel, não em contagem de entradas.

### DO2.2 — Sem `refetchInterval`: reabrir é a atualização

`staleTime: 0`, mesma convenção do `ProcessesPanel` (O-1) — a leitura fica stale imediatamente, mas só relê ao remontar. Cogitado e descartado adicionar polling automático (a API existe e foi conferida via Context7): a § 4.5 da fundamentação já registra o gatilho — um painel que precisa de atualização contínua para cumprir seu papel deveria sair do modal, não ganhar um temporizador dentro dele. Nenhum painel deste plano justifica essa saída ainda.

### DO2.3 — Os contadores de IPC vivem em `core/`, a fiação em `registry.ts`

`registry.ts` já é, por desenho, "o único arquivo que conhece `ipcMain.handle`" (skill `ipc`). A lógica de contar — que é pura, sem `electron` — fica em `core/observatory/ipcStats.ts` como `createIpcStatsStore()`, testável no nível 1 com um relógio injetado. `registry.ts` só instancia o store uma vez e envolve `fn` com `store.wrap(channel, fn)` antes de `ipcMain.handle`, sem duplicar a lógica de tempo/erro inline.

### DO2.4 — `lastError` é pegajoso: um sucesso depois não apaga a última falha

O objetivo do contador é responder "este canal já falhou, e quando foi a última vez" mesmo que a chamada seguinte tenha ido bem — é a mesma pergunta que o mostrador de fila responde para o worker morto. Resetar `lastError` no primeiro sucesso escondería exatamente o sinal que o painel existe para mostrar.

### DO2.5 — `job:list` devolve só os ids, sem inventar metadado

`jobs.ts` não guarda rótulo, tipo nem `createdAt` — só o `AbortController`. O canal devolve `JobId[]`; nenhum campo é fabricado para parecer mais completo. Mesmo argumento da `DO1.8` (`idleWakeupsPerSecond` fora do contrato): campo que a fonte não preenche não entra.

### DO2.6 — A fila do worker mede profundidade, não tempo por requisição

A classificação da fundamentação (§ 6) pede "profundidade", não `queued`/`running`/`total` por consulta. Medir os três exigiria carimbar tempo em cada `postMessage`/`message` do protocolo `WorkerRequest`/`WorkerResponse` — instrumentação num caminho que hoje só copia bytes, e que `dataset:query` já paga caro o bastante (skill `data`, veredito Arrow-vs-JSON). Esse detalhamento fica para quando a trilha de desempenho (medição por modelo/canal) já estiver tocando a borda de `ai:*`, não antes — ver _Fora do escopo_.

### DO2.7 — Nenhum payload entra no registro

Os contadores guardam `channel`, contagens e a **mensagem** de erro (string), nunca `args` nem `result`. Coerente com a regra de mão única (`secrets:read` não existe) e com o livro-razão de privacidade (§ 2.4 da fundamentação): o Observatório diagnostica a infraestrutura, não vira uma segunda fonte de conteúdo da aplicação.

### DO2.8 — Payload inválido (zod) não conta como falha do canal

`argsSchema[channel].safeParse` falhando é o handler recusando um cliente que mentiu — bug a doer no console, pela régua `Result` vs. exceção da skill `ipc`. Contar isso junto de uma falha real do handler misturaria "o cliente mandou lixo" com "o handler está com problema", dois defeitos com conserto em lugares diferentes. `store.wrap()` envolve só `fn`, depois da validação — a rejeição de schema continua lançando exatamente como hoje, só não soma ao contador.

---

## Os três canais, nos seis lugares

| # | Onde | `app:ipcStats` | `job:list` | `dataset:queueDepth` |
| --- | --- | --- | --- | --- |
| 1 | `src/shared/ipc.ts` → `argsSchema` | `z.void()` | `z.void()` | `z.void()` |
| 2 | `src/shared/ipc.ts` → `IpcContract` | `{ args: …; result: AppIpcStat[] }` | `{ args: …; result: JobId[] }` | `{ args: …; result: number }` |
| 3 | `src/shared/ipc.ts` → `Api` | `app.ipcStats: () => Promise<AppIpcStat[]>` | `job.list: () => Promise<JobId[]>` | `dataset.queueDepth: () => Promise<number>` |
| 4 | `src/main/features/<x>/handlers.ts` | `readIpcStats(getStats)` — `features/app/` | `listJobs()` — `features/job/` | `readQueueDepth(getDepth)` — `features/dataset/` |
| 5 | `src/main/ipc/register-all.ts` | `handle('app:ipcStats', () => readIpcStats(getIpcStats))` | `handle('job:list', () => listJobs())` | `handle('dataset:queueDepth', () => readQueueDepth(duckdbClient.queueDepth))` |
| 6 | `src/preload/index.ts` | `invoke('app:ipcStats')` | `invoke('job:list')` | `invoke('dataset:queueDepth')` |

O sétimo avisa sozinho: `test/api-mock.ts` é `satisfies Api` e para de compilar sem os três métodos.

```ts
export type AppIpcStat = {
  channel: string
  callCount: number
  errorCount: number
  lastDurationMs: number
  lastError: string | null // sticky (DO2.4) — survives a later success
}
```

---

## Passos

### 1. O núcleo puro dos contadores de IPC (DO2.3, DO2.4, DO2.8)

`core/observatory/ipcStats.ts`: `createIpcStatsStore(now?: () => number)` devolve `{ wrap, snapshot }`. `wrap(channel, fn)` cronometra e delega, sem engolir a exceção — o `throw` original atravessa intacto. Nível 1, relógio falso injetado: sucesso incrementa `callCount` e atualiza `lastDurationMs`; falha incrementa `errorCount` e grava `lastError`; um sucesso **depois** de uma falha não limpa `lastError` (DO2.4); `snapshot()` ordena por `callCount` desc, mesma convenção de `summarizeProcesses` (O-1).

### 2. A fiação, e os dois acessores que faltam (DO2.5, DO2.6)

`registry.ts` instancia o store uma vez no módulo, envolve `fn` com `store.wrap(channel, fn)` antes de `ipcMain.handle`, exporta `getIpcStats()`. `jobs.ts` ganha `list(): JobId[]` (`Array.from(controllers.keys())`) — nível 1 já existente em `jobs.test.ts` ganha um caso. `createEnqueue` em `spawnWorker.ts` ganha um contador `depth` (incrementa ao enfileirar), decrementado **no mesmo encadeamento de `tail` que já engole a rejeição** — nunca num `settled.finally()` à parte, que criaria uma segunda promessa derivada sem handler e derrubaria o processo main em `unhandledRejection` justamente no caso que este painel existe para mostrar (worker morre, `onExit` rejeita). `createDuckdbWorkerClient` expõe `queueDepth: () => number` no client.

⚠️ Nenhum dos dois acessores (`jobs.list`, `queueDepth`) importa `electron` — mesma régua do handler exportável.

### 3. Os três canais, nos seis lugares

Handlers triviais (`readIpcStats(getStats)`, `listJobs()`, `readQueueDepth(getDepth)`), nível 3 contra fontes falsas — um `getStats` que devolve uma lista fixa, um `getDepth` que devolve um número fixo. `test/api-mock.ts` atualizado; o typecheck para de compilar até isso acontecer.

### 4. O painel _Em andamento_ (DO2.1, DO2.2)

Um componente em `features/observatory/`, registrado em `panels.ts` sob o grupo _Estado_ (o único que o O-1 abriu), com três blocos empilhados: canais IPC (tabela, ordenada por chamadas — reaproveita `DatasetTable`/`formatCell` se a forma servir, senão uma tabela simples do mesmo padrão visual), jobs ativos (contagem + lista de ids em fonte monoespaçada), fila do worker (um número). `staleTime: 0`, sem `refetchInterval` (DO2.2).

Nível 2: o painel mostra os três blocos contra dados falsos; um id de job na lista de entrada aparece renderizado.

### 5. Conferência ao vivo — com o usuário

Curta, e só o que teste nenhum alcança:

1. Abrir o observatório, fechar, abrir uma conversa e anexar um dataset — reabrir o observatório e ver `dataset:attach`/`dataset:query` na lista de canais com `callCount` > 0.
2. Fazer uma pergunta e cancelar em seguida (botão de stop) — o job deve aparecer e depois sumir da lista de ativos.
3. Anexar dois datasets em sequência rápida (ou abrir duas pré-visualizações) e observar a fila do worker passar de 0 momentaneamente — a prova visível do risco que `ARMADILHAS.md` registra sem conserto.

---

## Verificação

- `pnpm check:fast` depois de cada passo.
- **Provocação obrigatória, uma sabotagem por vez:**
  - fazer `wrap` engolir a exceção (não relançar) → nível 1 reprova, e o comportamento do canal mudaria de forma que nenhum teste de handler pegaria sozinho — é por isso que o nível 1 testa o `wrap` isolado;
  - remover o comportamento pegajoso de `lastError` (resetar em sucesso) → nível 1 reprova;
  - decrementar `depth` numa promessa derivada separada (`settled.finally(...)`) em vez do encadeamento de `tail` já tratado → provocar o worker morrendo no meio da fila tem de **não** derrubar o processo main com `unhandledRejection`, e `depth` tem de voltar a 0 mesmo nesse caminho — é a provocação com dente, porque é o próprio risco que o painel existe para mostrar.
- **Sem caso E2E novo.** Mesmo raciocínio do O-1: nada aqui depende de `<dialog>` nem de número do sistema operacional que os níveis 1–3 não alcancem.

---

## Fora do escopo deste plano

- **Persistência de qualquer contador** — `observatory.db` é O-6; os contadores deste plano zeram a cada reinício do app, exatamente como os painéis do O-1.
- **`queued`/`running`/`total` por consulta do worker** (DO2.6) — exigiria carimbar tempo no protocolo `WorkerRequest`/`WorkerResponse`, caminho que já é hot path (skill `data`). Fica para quando a instrumentação de desempenho tocar essa borda, não antes.
- **Reinício automático do worker morto** — é o conserto do risco, não a visibilidade dele. `ARMADILHAS.md` continua sendo o registro até esse plano existir; este é o plano que só o **mostra**.
- **Metadado de job** (rótulo, tipo, horário de início) — `jobs.ts` não guarda isso hoje (DO2.5); vira escopo do dia em que um consumidor real precisar rotular jobs.
- **Filtro/busca dentro do painel** — três blocos pequenos não justificam (§ 4.4 da fundamentação: busca se paga acima de ~12 painéis).

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
| --- | --- | --- | --- |
| 31/08/2026 | — | plano escrito, ainda não executado | Escrito após sessão de análise do relatório externo (`notes/observatory/report.md`) contra o código real e as seis skills do projeto — achou que a alegação do relatório sobre o worker morto já corrigido é falsa (conferido em `ARMADILHAS.md`). Context7 (`tanstack/query`) confirmou a forma atual de `refetchInterval` e sustentou a decisão de **não** usá-lo (DO2.2). |
| 31/08/2026 | 1–4 | passos 1–4 entregues; **falta o passo 5 (conferência ao vivo, do usuário)** | `pnpm check:fast` verde, 1167 testes. Duas revisões do advisor, cada uma achou um defeito real antes de virar código/ficar sem teste: (1) na escrita do plano, o `depth--` num `settled.finally()` separado da `tail` criaria uma promessa derivada sem tratador de rejeição — `unhandledRejection` no processo main exatamente quando o worker morre no meio da fila, o próprio risco que o painel existe para mostrar; corrigido antes da implementação, e provocado ao vivo nesta sessão (o teste em `spawnWorker.test.ts` reproduziu o crash com a forma errada). (2) na revisão do resultado, `ActivityPanel` coalescia leitura pendente/com erro em `0`/vazio — violava a própria regra "métrica ausente não é zero" (DO1.8) que a trilha adotou; corrigido com `ViewState` explícito por bloco, `lastError` passou a aparecer na linha do canal (não só em `title`), e a skill `ipc` foi remedida (39 → 42 canais). Conteúdo validado do `notes/observatory/report.md` ainda não foi dobrado em `docs/reference/observatory/` — fica para o fechamento desta sessão, por pedido do usuário. |
| 31/08/2026 | 5 | **plano concluído** | Conferência ao vivo feita pelo usuário: uso real do app (conversa, datasets, IA) produziu 29 canais distintos na tabela, todos com 0 falhas — nenhum erro real para exercitar `lastError`, mas as durações batem com o esperado (`ai:chat` ~28s, `dataset:pick` ~9s de diálogo do SO, `ai:isAvailable` ~1,6s de sondagem do Ollama). A transição da fila do worker (1→0) foi rápida demais para observar no olho — esperado e correto: DO2.6 mede profundidade **agora**, não um monitor sustentado. Jobs ativos em 0, consistente com nenhuma operação em voo no momento da leitura. |
