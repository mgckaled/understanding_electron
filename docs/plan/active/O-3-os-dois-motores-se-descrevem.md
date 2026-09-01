# O-3 — os dois motores se descrevem: DuckDB em vigor e o `crivo.db`

> Terceiro plano da trilha O. A fundamentação inteira — os seis eixos, a classificação de custo/trabalho/situação, o critério `crivo.db` vs. `observatory.db` — é de [`docs/reference/observatory/`](../../reference/observatory/README.md). Este plano **não a repete: aplica**. Toda referência a "§ n" abaixo é seção daquele documento.

**Origem:** o [`O-1`](O-1-a-casca-do-observatorio.md) e o [`O-2`](O-2-ipc-jobs-e-fila-do-worker.md) cobriram cinco das seis linhas `Grátis` do inventário (§ 6). A sexta, **Motor em vigor** (`Grátis/Moderado`), seguia disponível — e ao lado dela, a primeira linha `Barato`, **Banco de dados** (`Barato/Moderado`), com fonte já registrada na mesma sessão de sondagem que fundamentou o O-1 (§ 7.2/7.3). Custo diferente, mas a mesma proximidade na fila (§ 8, regra 1: situação decide entrar, custo decide a posição — as duas entram, uma logo atrás da outra) e a mesma fonte de sondagem justificam fundir as duas num corte só, em vez de um plano de uma linha só.

**Entrega:** dois canais (`dataset:engineInfo`, `database:info`) e **dois** painéis — não um: ao contrário do O-2 (DO2.1), as duas fontes pertencem a categorias diferentes da própria fundamentação (§ 4.4: `Motor em vigor` é configuração viva, cai em _Estado_; `Banco de dados` é o primeiro conteúdo de _Armazenamento_, grupo que nasce vazio desde o O-1). Nenhuma persistência nova.

---

## O que a sondagem achou, e que o desenho não previa

Context7 (`duckdb/duckdb-web`, `nodejs/node`) e busca web em 31/08/2026:

| Afirmação plausível | O que é verdade |
| --- | --- |
| `enable_external_access = false` bloquearia `duckdb_settings()`/`duckdb_extensions()`/`duckdb_memory()` | **Não.** A trava é só sobre acesso a arquivo/rede — `ATTACH`, `COPY`, `read_csv`/`read_parquet`/`read_json` — não sobre funções de tabela do catálogo interno, que não tocam o sistema de arquivos (Context7, `duckdb/duckdb-web`, _Security Overview_). Confirma que o motor restrito (skill `data`) não precisa de exceção nenhuma para este plano |
| `lock_configuration = true` bloquearia a leitura de `duckdb_settings()` | **Não.** A trava é só sobre `SET` subsequente — `SELECT` de qualquer tabela de sistema continua livre (Context7, mesma fonte). O plano lê, nunca escreve configuração |
| `duckdb_extensions()` lista só o que este app carregou | Lista **todas** as extensões conhecidas pelo binário — a maioria `loaded: false, installed: false`. Sem filtro, o painel mostraria dezenas de linhas irrelevantes; a query já nasce com `WHERE loaded OR installed` (regra 3 da § 4.3: resumo, não a coisa inteira) |
| `duckdb_memory()` devolve uma lista fixa de tags, sempre as mesmas | Não documentado como fixo — os exemplos da doc (`BASE_TABLE`, `HASH_TABLE`, `PARQUET_READER`, `ALLOCATOR`) sugerem que só tags com alocação real aparecem. Mesmo assim, a query filtra `memory_usage_bytes > 0 OR temporary_storage_bytes > 0` por segurança — mesma regra 3 |
| `COUNT(*)` por tabela do `crivo.db` é grátis | Não — SQLite não guarda contagem, percorre páginas (§ 7.3, já registrado). Aceito aqui porque a classificação da fundamentação já é `Barato`, não `Grátis` — mas é o gatilho de revisão se `messages` crescer a ponto de a leitura no boot do painel incomodar (nenhuma medição ainda) |
| `page_count` e `freelist_count` bastam para `sizeBytes` | Falta `PRAGMA page_size` — a § 7.3 não o nomeia, mas `database_size = page_count × page_size` é a própria fórmula que ela dá; sem ele o tamanho sai errado por um fator constante. Os três entram no passo 3, não só os dois citados |
| `db.exec('PRAGMA x')` devolve o valor lido | **Não** — `exec()` não devolve linha nenhuma no `node:sqlite` (é para statement sem resultado). O padrão já em uso no projeto, `db.prepare('PRAGMA x').get()`, é o único correto — confirmado contra `open.ts`, que já faz isso para `user_version` (reaproveitado aqui, não duplicado) |
| A leitura do motor DuckDB é local ao main, sem tocar o worker | **Não pode ser** — o motor vive em `workers/duckdb/` (skill `data`); qualquer leitura dele é uma requisição a mais na mesma fila que o O-2 tornou visível. Efeito colateral bom: abrir o painel _Motor DuckDB_ faz `dataset:queueDepth` piscar 1, prova ao vivo de que o mostrador do O-2 nota **qualquer** requisição, não só `query`/`profile` |

---

## Decisões

### DO3.1 — Dois painéis, não um: os grupos da fundamentação já os separam

Ao contrário do O-2 (DO2.1, três fontes da mesma categoria "atividade agora"), aqui as duas fontes são categorias diferentes por definição da própria § 4.4: `Motor em vigor` é configuração viva do processo (mesma família de _Runtime_, grupo _Estado_); `Banco de dados` é conteúdo do grupo _Armazenamento_, que nasce vazio desde o O-1 e ganha aqui seu primeiro painel. Forçar os dois num painel só quebraria a navegação por categoria que `panels.ts` já promete.

### DO3.2 — `dataset:engineInfo` toca o worker, e por isso herda o risco do O-2

Ao contrário de `dataset:queueDepth` (leitura de contador em memória, não pode falhar), ler `duckdb_settings()`/`duckdb_extensions()`/`duckdb_memory()` exige um round-trip pela mesma fila de `query`/`profile`/`transform` — e herda o mesmo risco que o O-2 tornou visível (worker morto deixa a chamada pendurada). Por isso `dataset:engineInfo` retorna **`Result`**, na mesma régua de `dataset:query`/`profile`/`transform` — não na régua Grátis de `app:info`/`dataset:queueDepth`.

### DO3.3 — `database:info` não retorna `Result`

Ler o próprio `crivo.db` já aberto, com `db.prepare(...).get()/.all()`, não tem modo de falha que a UI precise distinguir — mesmo argumento de `conversation:list`/`settings:read`. Um `db` corrompido a ponto de uma `PRAGMA` falhar é bug, não estado de produto; a exceção sobe crua, pela régua da skill `ipc`.

### DO3.4 — A lista de tabelas é derivada de `sqlite_master`, nunca escrita à mão

Mesma regra 5 da § 4.3 (e a mesma lição do glossário do mill.tools, § 1.6): uma tabela nova (a próxima migração) aparece no painel sem tocar este código. A contagem de linhas por tabela usa o nome lido do próprio `sqlite_master` — nunca uma lista `['conversations', 'messages', ...]` copiada de `migrations.ts`.

### DO3.5 — `currentVersion()` é reaproveitado, não duplicado

`src/main/db/open.ts` já exporta `currentVersion(db)` para a própria escada de migração. O painel usa a mesma função — uma segunda leitura de `PRAGMA user_version` escrita à mão seria a duplicação que a convenção de fonte única do projeto proíbe.

### DO3.6 — O motor DuckDB não ganha botão de manutenção neste plano

A fundamentação registra que "o que escreve num observatório é sempre manutenção do que ele observa" (§ 1.4, com o precedente de `VACUUM` sobre `freelist_count` alto). Este plano fica **só leitura**: nem `VACUUM` no `crivo.db`, nem qualquer ação corretiva. Não há ainda uma convenção de "botão de manutenção" no Observatório do crivo — inventar uma agora, para um caso só, decidiria uma convenção maior de passagem, o que este corte não deveria fazer sozinho. `freelist_count` alto fica **visível**, sem botão — o mesmo padrão do O-2 (mostra o risco, não conserta).

### DO3.7 — Extensões filtradas a `loaded OR installed`

A tabela completa do binário tem dezenas de linhas irrelevantes (regra 3 da § 4.3: resumo, não a coisa inteira). O filtro acontece na query, não no componente — a UI nunca recebe o que não vai mostrar.

---

## Os dois canais, nos seis lugares

| # | Onde | `dataset:engineInfo` | `database:info` |
| --- | --- | --- | --- |
| 1 | `src/shared/ipc.ts` → `argsSchema` | `z.void()` | `z.void()` |
| 2 | `src/shared/ipc.ts` → `IpcContract` | `{ args: …; result: Result<DuckDbEngineInfo> }` | `{ args: …; result: DatabaseInfo }` |
| 3 | `src/shared/ipc.ts` → `Api` | `dataset.engineInfo: () => Promise<Result<DuckDbEngineInfo>>` | `database.info: () => Promise<DatabaseInfo>` — **domínio novo** |
| 4 | `src/main/features/<x>/handlers.ts` | `readEngineInfo(runEngineInfo)` — `features/dataset/` | `readDatabaseInfo(db)` — `features/database/` (**pasta nova**) |
| 5 | `src/main/ipc/register-all.ts` | `handle('dataset:engineInfo', () => readEngineInfo(duckdbClient.runEngineInfo))` | `handle('database:info', () => readDatabaseInfo(db))` |
| 6 | `src/preload/index.ts` | `invoke('dataset:engineInfo')` | `invoke('database:info')` |

O sétimo avisa sozinho: `test/api-mock.ts` é `satisfies Api` e para de compilar sem os dois — inclusive o domínio `database` inteiro, que ainda não existe no mock.

```ts
export type DuckDbExtensionInfo = {
  name: string
  loaded: boolean
  installed: boolean
  version: string | null
}
export type DuckDbMemoryTag = { tag: string; bytes: number }
export type DuckDbEngineInfo = {
  /** The value duckdb_settings() reports as applied — a display string, not parsed to bytes: no second unit crosses this contract (unlike DO1.7's AppProcess). */
  memoryLimit: string
  extensions: DuckDbExtensionInfo[]
  memoryByTag: DuckDbMemoryTag[]
}

export type DatabaseTableInfo = { name: string; rowCount: number }
export type DatabaseInfo = {
  migrationVersion: number
  sizeBytes: number
  /** `PRAGMA freelist_count` — named after the pragma, not "free pages", so a grep by symbol finds this field (advisor finding). */
  freelistCount: number
  tables: DatabaseTableInfo[]
}
```

`WorkerRequest`/`WorkerResponse` (`core/duckdb/protocol.ts`) ganham a variante `engineInfo`, espelhando `schema`:

```ts
| { kind: 'engineInfo' } // request, sem argumento — o motor já sabe de si mesmo
| { kind: 'engineInfo'; ok: true; info: DuckDbEngineInfo }
| { kind: 'engineInfo'; ok: false; message: string }
```

---

## Passos

### 1. As três queries do motor, puras (DO3.7)

`core/duckdb/engineInfo.ts`: três funções que devolvem só o texto SQL — `buildMemoryLimitSql()`, `buildExtensionsSql()` (com o `WHERE loaded OR installed`), `buildMemoryByTagSql()` (com o `WHERE ... > 0`) — mesma forma de `schema.ts`/`buildDescribeSql`. Nível 1: cada função devolve a string esperada, sem tocar o motor.

⚠️ Sondar ao vivo neste passo, antes de escrever o handler do passo 3: confirmar os nomes de coluna contra a versão de `@duckdb/node-api` em uso (`memory_usage_bytes` pode não bater 1:1 com a doc entre versões — aviso já registrado na § 7.2).

### 2. `handleEngineInfo` no worker, e mais um consumidor da fila (DO3.2)

`workers/duckdb/index.ts` ganha `handleEngineInfo()`, rodando as três queries pela mesma `connection` e devolvendo `WorkerResponse` no formato `engineInfo`. Entra no `switch` de `handleRequest`. `main/duckdb/spawnWorker.ts` ganha `runEngineInfo` no client devolvido por `createDuckdbWorkerClient`, passando por `enqueue({ kind: 'engineInfo' })` — mesma fila que `queueDepth` (O-2) já mede, sem mecanismo novo.

### 3. `readDatabaseInfo`, e a pasta nova `features/database/` (DO3.3, DO3.4, DO3.5)

`src/main/features/database/handlers.ts`: `readDatabaseInfo(db: DatabaseSync): DatabaseInfo` — `currentVersion(db)` reaproveitado de `main/db/open.ts`; `page_count`/`page_size`/`freelist_count` por `db.prepare('PRAGMA ...').get()`; tabelas por `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`, uma `COUNT(*)` por nome achado. Nível 3, contra um `DatabaseSync(':memory:')` real com a escada de migração rodada — nunca fake, mesmo princípio da skill `testing` para o que persiste.

### 4. Os dois canais, nos seis lugares (DO3.1)

`readEngineInfo(runEngineInfo)` em `features/dataset/handlers.ts`, com `Result` — `try/catch` em volta do `runEngineInfo()`, mesma forma de `profileDataset`. Registro em `register-all.ts`; `preload/index.ts` ganha o domínio `database` inteiro (primeira aparição); `test/api-mock.ts` idem.

### 5. Os dois painéis (DO3.1, DO3.6)

`EnginePanel.tsx` (grupo `state`, rótulo "Motor DuckDB"): limite de memória em vigor, lista de extensões (nome, carregada/instalada, versão — a linha que confirma ao vivo a versão travada do `excel.duckdb_extension`, hoje só documentada em `CLAUDE.md`), memória por tag. `DatabasePanel.tsx` (grupo `storage`, rótulo "Banco de dados"): versão de migração, tamanho total, páginas livres (sem botão — DO3.6), tabelas com contagem. Os dois seguem o padrão `ViewState` explícito que o O-2 corrigiu — nenhuma leitura pendente ou com erro pode ler como `0`/vazio (regra 6 da § 4.3).

Nível 2: os dois painéis contra fonte falsa; o `EnginePanel` mostra a extensão `excel` na lista quando presente no mock; o `DatabasePanel` mostra as cinco tabelas de `migrations.ts` quando o mock as lista.

### 6. Conferência ao vivo — com o usuário

1. Abrir o painel _Motor DuckDB_: o limite de memória bate com `DUCKDB_MEMORY_LIMIT` (`config.ts`); a extensão `excel` aparece carregada, com a versão que `scripts/fetch-duckdb-excel-extension.mjs` vendorizou.
2. Anexar um dataset e reabrir o painel: `memoryByTag` deixa de estar vazio (ou de mostrar só tags residuais) — prova de que a leitura reflete o motor real, não um valor congelado.
3. Abrir o painel _Banco de dados_: a contagem de `conversations`/`messages` bate com o que a sidebar já mostra.
4. Abrir o painel _Motor DuckDB_ e, no mesmo instante, olhar o painel _Em andamento_ (O-2) — confirmar que `dataset:queueDepth` reagiu à leitura do motor, não só a `query`/`profile`.

---

## Verificação

- `pnpm check:fast` depois de cada passo.
- **Provocação obrigatória, uma sabotagem por vez:**
  - remover o `WHERE loaded OR installed` de `buildExtensionsSql()` → nível 1 reprova (a string esperada muda);
  - fazer `readEngineInfo` engolir a exceção do worker sem devolver `err(...)` → o nível 3 (fonte falsa que rejeita) tem de reprovar — mesma lição do O-2: um `Result` que não embrulha a falha real é pior que exceção crua;
  - provar a DO3.4 pelo lado certo: no nível 3, `db.exec('CREATE TABLE probe_o3 (x INT)')` contra o `:memory:` já migrado, **depois** de escrever `readDatabaseInfo`, e exigir que `probe_o3` apareça no resultado com `rowCount: 0` — uma lista de nomes hardcoded reprova este teste; a query sobre `sqlite_master` passa (não dá para sabotar `sqlite_master` em si, é catálogo do próprio SQLite — o que se sabota é a tentação de escrever a lista à mão em vez de lê-la).
- ⚠️ **Verificação que nenhuma provocação de nível 1–3 alcança:** depois do passo 4, conferir que `src/preload/index.ts` segue com um único `import type { … } from '@shared/ipc'` e nenhum import de valor — o domínio `database` é a primeira vez que este arquivo cresce desde que a armadilha do zod vazando para o bundle do preload foi diagnosticada (skill `ipc`), e o sintoma é janela em branco **sem nenhum erro no terminal**. É por isso que a conferência ao vivo (passo 6) tem de acontecer de qualquer forma, mesmo com os três níveis verdes.
- **Sem caso E2E novo.** Nada aqui depende de `<dialog>` nem de número do sistema operacional fora de alcance dos níveis 1–3.

---

## Fora do escopo deste plano

- **Botão de manutenção** (`VACUUM`, remedir extensões) — DO3.6; convenção de ação corretiva no Observatório é decisão maior, não deste corte.
- **Anexos** (blobs, bytes, economia de dedup, órfãos) — próxima linha `Barato/Moderado` do inventário (§ 6), mas fonte diferente (`attachments/gc.ts`, não os dois motores); fica para o próximo plano da fila, não empilhado aqui.
- **Uso de conversa** (modelos usados, respostas interrompidas) — mesma classificação de custo, mas assunto de conteúdo de conversa, não de motor; outro corte.
- **Persistência de série temporal de memória/tamanho** — `observatory.db` é O-6; os dois painéis leem o **agora**, como todo painel da trilha até aqui.
- **Índice RAG em DuckDB-arquivo** — Gatilhado (§ 6): não existe RAG ainda.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
| --- | --- | --- | --- |
| 31/08/2026 | — | plano escrito, ainda não executado | Context7 (`duckdb/duckdb-web`) descartou dois riscos presumidos (`enable_external_access`/`lock_configuration` bloqueando leitura de tabelas de sistema — nenhum dos dois bloqueia `SELECT`) antes de virarem decisão de design. Busca web confirmou que `db.exec('PRAGMA x')` não devolve linha no `node:sqlite` — o padrão já em uso (`db.prepare(...).get()`) é o único correto. Dois painéis, não um (DO3.1) — decisão que diverge conscientemente do precedente DO2.1, por os grupos da fundamentação já separarem as duas fontes. |
