# O-5 — Uso de disco e cache do Chromium: o `userData/` se revela

## Contexto

A trilha O (Observatório) segue o corte já fixado em [`ROADMAP.md`](../../ROADMAP.md) § 2: **O-5 = "uso de disco e cache do Chromium"**. O-1 a O-4 já entregaram a casca, os canais de baixo custo (Runtime, Processos, Em andamento, Motor DuckDB) e o primeiro painel Caro (Capacidades). O-5 é o próximo corte Disponível do inventário de [`reference/observatory/README.md`](../../reference/observatory/README.md) § 6: duas linhas —

| Painel | Custo | Trabalho | Fonte |
|---|---|---|---|
| Cache do Chromium | Acessível | Leve (na tabela — corrigido abaixo) | `session.getCacheSize()` (§ 7.5) |
| Uso de disco | Caro | Pesado | walk como job, com a separação da § 3.1 |

O motivo de as duas nascerem no mesmo plano não é só a ordem do ROADMAP — é mecânico: **o mecanismo do painel de cache é o que torna o walk do painel de disco afordável**, ver DO5.3 abaixo. `userData/` (`%APPDATA%/crivo`) já existe e já guarda `crivo.db`, `attachments/`, `duckdb-tmp/` (autoria do crivo) ao lado de `Cache/`, `Code Cache/`, `GPUCache/`, `Local Storage/` e outras pastas que só o Chromium escreve (§ 3.1). O observatório não cria esse diretório — ele o revela, e revelar sem separar as duas autorias faz o usuário investigar o motor embutido por engano (§ 3.1, linha ⚠️).

## Sondagem — o que a leitura encontrou, e uma correção

Consultado: `docs/reference/observatory/README.md` (§ 3, § 4.3, § 5, § 6, § 7.5), `ROADMAP.md` § 2, código-fonte atual (`src/main/jobs.ts`, `src/main/features/app/handlers.ts`, `src/main/features/dataset/attachExcel.ts`, `src/main/ipc/register-all.ts`, `src/preload/index.ts`, `src/renderer/src/features/observatory/{panels.ts,CapabilitiesPanel.tsx,DatabasePanel.tsx}`, `src/renderer/src/shared/hooks/useJobProgress.ts`, `src/core/fsError.ts`), Context7 (`/websites/electronjs`, doc de `session`) e busca web (Node 24, `fs.promises.readdir`).

- **`session.getCacheSize()` mede só o cache HTTP (`Cache/`)** — a documentação oficial do Electron não estende essa chamada a `Code Cache/` (que só tem `clearCodeCaches`, sem `getCodeCacheSize` equivalente) nem a `GPUCache/`. O § 7.5 do README do observatório não afirma o contrário, mas a leitura apressada poderia assumir que "o cache do Chromium" é uma coisa só — não é. O painel "Cache do Chromium" mede e limpa **o cache HTTP**, ponto; o resto das pastas do Chromium entra no total genérico do painel "Uso de disco".
- ⚠️ **Mas a doc oficial diz "o tamanho atual do cache da sessão", não "o total de bytes do diretório `Cache/` no disco" — os dois não foram verificados como o mesmo número.** É a mesma lição da § 7.5 (o método certo, a pergunta errada) aplicada ao contrário: agora é a *pergunta* que parece certa e o *método* que precisa de medição antes de a arquitetura depender dele. Resolvido no Passo 0 abaixo, antes de congelar a forma de `DiskUsage`.
- **A classificação do inventário (§ 6) tem uma imprecisão que vale corrigir ao codar** — "Cache do Chromium" está marcada Trabalho **Leve**, mas a definição do próprio documento (§ 5.2: "Leve = compõe sobre canal que já existe") não bate — não existe canal para `session.getCacheSize()`/`clearCache()` hoje, então dois canais novos tornam isto **Moderado**. Registrado como DO5.8, com correção da linha em `reference/observatory/README.md` no Passo 6 (auto-conservação (b) do `CLAUDE.md` — contagem/classificação que envelheceu não se copia sem reconferir).
- **`fs.promises.readdir(dir, { withFileTypes: true })`** evita `stat` por entrada (a opção do Node de `recursive: true` é síncrona por baixo e não compõe com `withFileTypes` de forma confiável — não usar; caminhar à mão, um nível por vez, com `AbortSignal` verificado entre diretórios).
- `main/jobs.ts` (`create`/`cancel`/`finish`, `AbortController` por `JobId`) e `useJobProgress`/`useJobChunks` no renderer já cobrem progresso e cancelamento — nenhum mecanismo novo necessário (`attachExcelDataset` é o precedente de job com progresso indeterminado, `phase: 'scanning'`, `total: null`).
- `src/main/features/app/handlers.ts` é o precedente de handler fino com dependência de runtime injetada por parâmetro (`getSystemMemory(freemem, totalmem)`) — mesmo molde para os handlers novos.
- **`src/main/index.ts` não define `partition` em `webPreferences`** (conferido por grep) — `session.defaultSession` é de fato a sessão da janela; não há uma segunda sessão medindo um cache que ninguém usa.
- `src/preload/index.ts` está em **96/100 linhas**, teto rígido ("100, sem exceção"). O bloco `disk` cabe numa linha (62 caracteres). O bloco `session` com dois métodos **não cabe numa linha** — medido: 108 caracteres contra `printWidth: 100` do Prettier (`.prettierrc.yaml`), que vai quebrá-lo em 4 linhas via `format_fix`. A verificação certa é "formatar, depois `wc -l`", não uma soma de linhas feita à mão — ver Passo 4.
- `docs/DECISOES.md` não tem linhas `DO4.*` hoje — as siglas de um plano em `active/` só entram no índice ao mover para `implemented/`. Nenhuma ação extra aqui.
- O segredo do `safeStorage` vive **dentro** do `crivo.db` (tabela de segredos, `main/features/secrets/`), não como arquivo próprio em `userData/` — a linha da § 3.1 não vira uma entrada extra no walk.

## Decisões

### DO5.1 — Dois painéis, não um

"Cache do Chromium" (Acessível — cacheia e não bloqueia abertura) e "Uso de disco" (Caro — sob botão, mostra idade) têm regras de UI incompatíveis (§ 5.1): fundir os dois num componente misturaria um `useQuery` sempre-ativo com um fluxo de job sob demanda. Precedente: DO1.2 já separou por esse motivo.

### DO5.2 — `session.getCacheSize()` mede só `Cache/`

Documentado no painel e no comentário do handler: não é o "cache do Chromium" inteiro, é o cache HTTP. Evita repetir, ao contrário, o erro que a § 7.5 já corrigiu uma vez (declarar por suposição em vez de medir).

### DO5.3 — O walk de disco reaproveita `getCacheSize()` para a entrada `Cache/`, **se o Passo 0 confirmar que os números batem**

Em vez de percorrer arquivo a arquivo uma pasta que pode ter milhares de entradas de cache HTTP (exatamente a razão pela qual uma sondagem anterior chegou a declarar essa varredura "Inviável", § 7.5), o job de "Uso de disco" chamaria `getCacheSize()` uma vez para medir `Cache/` e caminharia normalmente pelas demais pastas do Chromium. É o motivo real de os dois painéis nascerem no mesmo plano — não coincidência de agenda. **Mas isto depende de uma premissa não verificada em documentação nenhuma:** que `getCacheSize()` (documentado só como "o tamanho atual do cache da sessão") de fato corresponde ao total de bytes do diretório `Cache/` no disco. O Passo 0 mede os dois no ambiente real antes de esta decisão virar código:

- **Bateram (poucos % de diferença):** DO5.3 vale como escrita acima — `Cache/` nunca é listada nem caminhada no walk, só `getCacheSize()`.
- **Divergiram:** `Cache/` deixa de ser caso especial — entra no walk genérico do bucket `runtime` como qualquer outra pasta (é I/O assíncrono dentro de um job cancelável, exatamente o que o mecanismo de job existe para absorver). `getCacheSize()` continua existindo, mas só alimenta `ChromiumCachePanel` — nenhum total de `DiskUsage` depende dele. Os dois painéis continuam saindo deste plano; muda apenas se um número entra na soma do outro.

**Medido no Passo 0, contra o `userData/` real do crivo** (`C:\Users\Usuário\AppData\Roaming\crivo`, sonda descartável via `electron.exe` puro, sem janela): `getCacheSize()` reportou **127.452.694 bytes**, a varredura recursiva de `Cache/` somou **134.664.478 bytes** — diferença relativa de **5,36%**. **Vale como "bateram":** a diferença é pequena, unidirecional (a varredura sempre soma mais) e consistente com o próprio mecanismo do cache do Chromium — o backend de disco mantém arquivos de índice e blocos esparsos alocados além do conteúdo "lógico" que `getCacheSize()` reporta, não é ruído de medição. `Cache/` fica fora do walk, resolvida só por `getCacheSize()` (ramo "bateram" adotado); o código carrega um comentário curto citando este número e a razão do gap, para que ninguém leia o `Uso de disco` contra o Explorador de Arquivos, ache que "falta ~7 MB" e trate isso como bug.

### DO5.4 — Classificação por allowlist pequena; o bucket do Chromium é **um número**, não uma lista

`ORIGIN_ALLOWLIST = ['crivo.db', 'crivo.db-wal', 'crivo.db-shm', 'attachments', 'duckdb-tmp']` volta `'crivo'`; qualquer outra entrada de topo em `userData/` é `'runtime'` e soma num único total (`runtimeBytes`), sem listar cada pasta interna do Chromium. Enumerar `Cache/`, `Code Cache/`, `GPUCache/`, `Local Storage/`, `IndexedDB/`, `Crashpad/`… reintroduziria o mesmo ruído que a separação da § 3.1 existe para evitar. Comentário no código aponta que `observatory.db` e o futuro DuckDB em arquivo do índice RAG (§ 2.6, § 3.1) entram nesta lista quando nascerem.

### DO5.5 — Erro de leitura numa subpasta não aborta o job inteiro

Métrica de disco é best-effort por natureza — diferente de um handler de domínio com um contrato de sucesso/falha único. Uma pasta ilegível (permissão, antivírus segurando um arquivo) marca a entrada correspondente como `partial: true` e soma o que deu para ler; o job só retorna `err(...)` se a própria raiz (`userData/`) não puder ser lida. Satisfaz a regra 6 da § 4.3 (métrica ausente não é zero) sem negar o painel inteiro por um arquivo trancado.

### DO5.6 — Dois domínios de canal novos: `session` e `disk`

`session:cacheSize`, `session:clearCache` (o objeto que a chamada envolve) e `disk:usage` (a operação, não o nome do painel) — não um domínio `observatory` genérico, que teria misturado fontes sem relação de contrato.

### DO5.7 — `formatAge` sobe para `shared/format.ts`

Hoje vive só em `CapabilitiesPanel.tsx`. `DiskUsagePanel` precisa da mesma "medido há Xmin" (§ 4.3, regra do painel Caro) — segundo chamador, mesma régua que promoveu `CapabilityChip` a primitivo no O-4.

### DO5.8 — Correção registrada da própria classificação do inventário

"Cache do Chromium" está listada Trabalho **Leve** em § 6; por § 5.2 (canal novo = Moderado), é **Moderado**. Fica dito aqui, não escondido — mesmo espírito da correção que a § 7.5 já registrou sobre o "Inviável" derrubado.

## Passos

### 0. Medir antes de fixar o tipo — `getCacheSize()` vs. o disco de verdade

Numa sonda descartável (script Node ad-hoc ou console do DevTools do próprio app em dev), comparar `await session.defaultSession.getCacheSize()` com a soma recursiva de bytes de `%APPDATA%/crivo/Cache` na máquina de desenvolvimento. Decide qual ramo de DO5.3 vale antes de escrever `core/observatory/disk.ts` — trocar a decisão depois de codada custaria reescrever a forma de `DiskUsage`, não só um `if`.

### 1. Tipos e contrato (`src/shared/ipc.ts`)

- `DiskEntry = { name: string; bytes: number; partial: boolean }`
- `DiskUsage = { crivo: DiskEntry[]; runtimeBytes: number; runtimePartial: boolean; totalBytes: number }`
- `argsSchema`: `'session:cacheSize': z.void()`, `'session:clearCache': z.void()`, `'disk:usage': z.object({ jobId: z.string() })`
- `IpcContract`: `session:cacheSize → number` (bytes), `session:clearCache → void`, `disk:usage → Result<DiskUsage>`
- `Api`: `session: { cacheSize(): Promise<number>; clearCache(): Promise<void> }`, `disk: { usage(jobId: JobId): Promise<Result<DiskUsage>> }`

### 2. A varredura pura (`src/core/observatory/disk.ts`)

`measureDiskUsage(userDataDir, getCacheSize, signal, emitProgress)` — lê o topo de `userDataDir` com `fs.promises.readdir(..., { withFileTypes: true })`, classifica por `ORIGIN_ALLOWLIST` (DO5.4), soma `crivo` recursivamente por entrada, resolve `Cache/` via `getCacheSize()` (DO5.3) e caminha o resto do bucket `runtime` recursivamente, catch por subárvore vira `partial: true` (DO5.5), checa `signal.aborted` entre diretórios. `getCacheSize` é injetado (nunca importa `electron`), testável em Node puro contra árvores de diretório reais criadas com `fs.mkdtempSync` — nunca mockado (mesmo princípio da skill `data`/`testing`: o que persiste se testa contra o real).

### 3. Handlers finos

- `src/main/features/session/handlers.ts` — `readCacheSize(getCacheSize)`, `clearChromiumCache(clear)`, passthrough no molde de `getSystemMemory`.
- `src/main/features/disk/handlers.ts` — `readDiskUsage({ jobId }, userDataDir, getCacheSize, emitProgress)`: `jobs.create` → `measureDiskUsage` → `Result` (cancelado vs. `ok`), `jobs.finish` no `finally`, no molde de `attachExcelDataset`.

### 4. Registro (`src/main/ipc/register-all.ts` e `src/preload/index.ts`)

- Importar `session` de `'electron'`.
- `handle('session:cacheSize', () => readCacheSize(() => session.defaultSession.getCacheSize()))`
- `handle('session:clearCache', () => clearChromiumCache(() => session.defaultSession.clearCache()))`
- `handle('disk:usage', (args) => readDiskUsage(args, app.getPath('userData'), () => session.defaultSession.getCacheSize(), broadcastJobEvent))` — `broadcastJobEvent` já existe (usado por `dataset:attach`).
- Preload: compactar `database: { info: () => invoke('database:info') }` para uma linha (libera 2 linhas, mesmo estilo de `shell`/`export`), acrescentar o bloco `disk` (cabe numa linha) e o bloco `session` (dois métodos — **não** força numa linha só, o Prettier vai quebrá-lo; escrever normal e deixar o `format_fix` decidir a quebra). Rodar `pnpm format` (ou deixar o hook `format_fix` agir no save) e só então `wc -l src/preload/index.ts` contra o teto de 100 — não somar linhas de cabeça antes de formatar.
- `test/api-mock.ts`: acrescentar os dois blocos (`satisfies Api` pega qualquer esquecimento no `typecheck`).

### 5. Painéis (`src/renderer/src/features/observatory/`)

- `shared/format.ts`: promover `formatAge`/`relativeAge` (DO5.7), reexportado por `CapabilitiesPanel.tsx`.
- `ChromiumCachePanel.tsx` — `useQuery(['session','cacheSize'], ..., { staleTime: 60_000 })` (Acessível: cache obrigatório, § 5.1), `Row` com `formatBytes`, botão "Limpar cache" (`useMutation` → `clearCache` → invalida a query), reaproveita `StateView`.
- `DiskUsagePanel.tsx` — botão "Sondar uso de disco" no molde de `CapabilitiesPanel` (gera `jobId` no renderer, `useMutation` chama `disk.usage`, `useJobProgress` alimenta uma barra indeterminada, botão "Cancelar" chama `job.cancel`); ao concluir, tabela `crivo` (nome/tamanho/aviso se `partial`), linha "Chromium (motor embutido)" com `runtimeBytes` (+ aviso se `runtimePartial`), total, e "Medido há Xmin · ↻" via `formatAge`.
- `panels.ts`: dois `ObservatoryPanel` novos no grupo `storage`, depois de `database` — `chromiumCache` e `diskUsage`, cada um com o comentário de proveniência (custo/trabalho, § 6) no molde das entradas existentes.

### 6. Auto-conservação — corrigir o documento-dono no mesmo commit

`docs/reference/observatory/README.md` § 6: a linha "Cache do Chromium" muda Trabalho de **Leve** para **Moderado** (DO5.8), com uma nota curta apontando o motivo (dois canais novos). Se o Passo 0 divergir, a coluna "Fonte que já existe" da mesma linha também perde a referência a "walk como job" ficando só em "Uso de disco" — ajustar as duas linhas juntas, não só uma.

## Verificação

- Nível 1: `src/core/observatory/disk.test.ts` contra árvores de diretório reais (`fs.mkdtempSync`) — casos: mistura crivo/runtime, subpasta ilegível (`partial`), cancelamento a meio do walk, `Cache/` resolvida só por `getCacheSize` (nunca listada como filhos).
- Nível 3: `src/main/features/session/handlers.test.ts`, `src/main/features/disk/handlers.test.ts` — injeção de `getCacheSize`/`clear` fake, `Function.length` como salvaguarda contra fechar sobre `electron`.
- Nível 2: `ChromiumCachePanel.test.tsx`, `DiskUsagePanel.test.tsx` via `test/store-api.ts`/mock — estados `loading`/`ready`/`error`, botão de limpar invalidando a query, barra de progresso indeterminada, linha `partial`.
- `pnpm typecheck` (os três projetos) e `pnpm check:fast`.
- Conferência ao vivo: abrir o Observatório de verdade, sondar "Uso de disco" numa máquina com `Cache/` populado (navegar/anexar antes), confirmar que o número bate com o Explorador de Arquivos por amostragem, testar "Cancelar" a meio do job, testar "Limpar cache" e reabrir o painel de cache confirmando queda do número.
- O Passo 0 (medição `getCacheSize()` vs. disco) é pré-requisito do Passo 2 — não avançar para o tipo/walk sem o resultado.

## Fora do escopo deste plano

- **Anexos** (painel Barato/Moderado, § 6) — Disponível, mas fora deste corte; ROADMAP fixa O-5 como cache+disco especificamente.
- `observatory.db` e qualquer série temporal — nasce só quando um painel Barato/Pesado exigir gravação (§ 8, item 2 das regras de ordem).
- Qualquer refinamento do bucket `runtime` (quebrar por subpasta do Chromium) — decisão deliberada em DO5.4, não uma lacuna.

## Diário de execução

| Data | Sessão | O que foi feito |
|---|---|---|
| 01/09/2026 | 1 | Plano escrito (skills `architecture`/`ipc`/`data`/`design-system`/`testing`/`comments`, Context7 + busca web, revisão do advisor Opus). Passo 0 executado ao vivo contra o `userData/` real: `getCacheSize()` 127.452.694 B vs. varredura 134.664.478 B (5,36%) — DO5.3 resolvida pelo ramo "bateram". |
| 01/09/2026 | 2 | Passos 1–6 implementados: contrato (`DiskEntry`/`DiskUsage`, `session:*`/`disk:usage`), `core/observatory/disk.ts` puro com teste de nível 1 (árvores reais), handlers finos + teste de nível 3, registro em `register-all.ts`/preload (99/100 linhas, medido depois de formatar), painéis `ChromiumCachePanel`/`DiskUsagePanel` + teste de nível 2, `formatAge` promovido a `shared/format.ts`, correção de Trabalho (Leve→Moderado) em `reference/observatory/README.md` § 6, `ROADMAP.md` atualizado (O-5 em andamento). `check:fast` verde (135 arquivos, 1217 testes) em quatro commits. **Falta:** conferência ao vivo do usuário (abrir o Observatório de verdade, sondar, cancelar, limpar cache) e submissão do resultado final ao advisor Opus. |
