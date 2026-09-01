# O-6 — `observatory.db` e fluxo de eventos: o primeiro plano que grava

> Sexto plano da trilha O. A fundamentação inteira é [`reference/observatory/README.md`](../../reference/observatory/README.md); este plano **aplica**, não repete. Toda referência a "§ n" é seção daquele documento.

**Origem:** [`ROADMAP.md`](../../ROADMAP.md) § 1, linha 41, nomeia O-6 como *"`observatory.db` e fluxo único de eventos — **a única fronteira da trilha**, o primeiro plano que grava"*. O-1 a O-5 só leem estado já existente na memória do processo; nenhum deles persiste nada de novo. O-6 muda essa natureza: nasce um arquivo, uma escada de migração própria, e um ponto de escrita no caminho quente de todo canal IPC.

**Entrega:** a tabela `events` em `observatory.db`, uma linha por chamada de canal IPC concluída (sucesso ou falha), o painel **Eventos** (grupo `activity`, primeira entrada do grupo), um campo de retenção configurável em `AppSettings`, e a varredura que apaga o que envelheceu além do prazo. Desempenho (O-7) e Privacidade (O-8) não nascem aqui — cada um paga sua própria migração quando chegar sua vez.

## Contexto

O critério de repartição entre os dois bancos está fechado em § 3.3: *"o que o usuário sentiria falta se sumisse fica no `crivo.db`; o que só o app sentiria falta vai para o `observatory.db`"* — banco separado, mesmo `openDatabase()` (§ 3.3, skill `architecture`), porque a política de retenção é oposta e um store best-effort não deve competir por WAL com o registro de conversa. § 3.2 fixa a regra que mais importa para este plano: **nunca uma linha por token ou chunk — agrega-se na borda, grava-se uma linha por operação IPC concluída**, e nomeia os três custos reais (frequência de escrita, migração, retenção — o crivo "ganha de lavada" no terceiro porque é `DELETE` sobre índice, não reescrita). § 3.4 traça a linha que este plano **não** cruza: veredito de proposta, nível de exposição por anexo e modelo/contexto por mensagem são registro inerente da conversa, moram no `crivo.db`, e nenhum deles nasce aqui. § 3.5 avisa que evento técnico não é operação de produto — uma pergunta do usuário produz vários eventos (`conversation:append`, criação do job, `ai:chat`, uma consulta ao DuckDB) — e a saída recomendada é correlacionar pelas identidades de domínio que já existem (`conversationId`/`messageId`/`JobId`) em vez de inventar um `observationId`. § 4.3 regra 6 ("métrica ausente não é zero") amarra o texto de transparência do painel: se o histórico foi podado, o painel precisa dizer isso, não parecer vazio por acidente.

## Sondagem — o que a leitura encontrou

- `src/core/observatory/ipcStats.ts` já mede exatamente o ponto certo: `createIpcStatsStore(now)` devolve `wrap(channel, fn)`, que faz `try { const result = await fn(args); record(channel, now() - start, null); return result } catch (error) { record(channel, now() - start, message); throw error }` — sucesso e falha já passam por `record()`. É o hook que o O-6 estende, não um mecanismo paralelo (§ 3.2 regra ①).
- ⚠️ **Conferido no fonte, e mudou o desenho do rascunho inicial:** `record()` roda **a cada chamada concluída**, não no momento do `wrap()`. O singleton `const ipcStats = createIpcStatsStore()` nasce em `src/main/ipc/registry.ts:5`, no escopo do módulo, **sem argumento** — antes de `registerAll()` existir. Um `onCall` recebido como parâmetro do construtor (`createIpcStatsStore(now, onCall)`) ficaria `undefined` para sempre, e a falha seria silenciosa: o painel Eventos simplesmente ficaria vazio, indistinguível de "nenhuma chamada ainda". O sink precisa ser um **setter mutável** dentro do store (DO6.2).
- `src/main/ipc/registry.ts`: `handle()` faz `const wrapped = ipcStats.wrap(channel, fn)` **depois** de validar o schema — nenhum payload inválido chega a gerar evento (mesma garantia que já protege o contador em memória do O-2, DO2.8).
- `src/main/db/open.ts`: `openDatabase(path: string, ladder: readonly Migration[] = migrations): DatabaseSync` aceita caminho e escada como parâmetros livres — a segunda base reusa a mesma função com uma segunda escada, sem tocar `open.ts`. `DATABASE_FILE = 'crivo.db'` vive nesse arquivo, ao lado da função.
- `src/main/db/migrations.ts`: um arquivo só, `const v1: Migration = (db) => { db.exec(\`...\`) }`, array `migrations` — não um arquivo por migração. ⚠️ **Conferido:** nenhuma tabela existente usa `STRICT` nem `AUTOINCREMENT` — o schema novo segue a mesma convenção, sem introduzir nenhuma das duas (`AUTOINCREMENT` cria `sqlite_sequence` e proíbe reuso de rowid, o oposto do que uma tabela só de INSERT/DELETE por idade precisa).
- `src/main/attachments/gc.ts`: `collectOrphanedAttachments(db: DatabaseSync, dir: string): Promise<void>` — recebe `db` como parâmetro (nunca abre conexão própria), roda no boot via `await collectOrphanedAttachments(db, attachmentsDir).catch(() => {})` dentro de `registerAll()` (`src/main/ipc/register-all.ts`, linha ~332). `db: DatabaseSync` como parâmetro é aceitável em qualquer camada (não é `electron`), mas este arquivo mora em `main/`, não em `core/`, porque compõe I/O real sobre uma conexão que só o composition root abre — precedente direto para onde o `INSERT`/`DELETE` de eventos deve morar.
- `registerAll()` devolve `() => { db.close(); duckdbWorker.kill() }`, ligado a `app.on('will-quit', closeDatabase)` em `src/main/index.ts:81-82` — o `close()` do banco novo entra na mesma função devolvida, sem mudar a assinatura de `registerAll()` nem de `main/index.ts`.
- `src/shared/ipc.ts:640-645`: `appSettingsSchema = z.object({ numThread: z.number().int().positive(), theme: themeSchema, lastExportDir: z.string().optional() })`, sem entrada em `DEFAULT_APP_SETTINGS` para `lastExportDir` — o default dele é resolvido no ponto de uso, não em `readSettings`. ⚠️ **Conferido:** `readSettings(_args: void, db: DatabaseSync): AppSettings` (`src/main/features/settings/handlers.ts:11`) é **síncrona**, ordem `(args, db)` — a chamada `readSettings(undefined, db).eventRetentionDays ?? 30` no Passo 5 não precisa de `await` e a ordem dos parâmetros está certa. As linhas 720/736 de `ipc.ts` (`numThread`/`numCtx` opcionais em `ai:chat`/`ai:propose`) são parâmetros de uma chamada ao modelo, domínio diferente — não precisam do campo novo.
- `src/renderer/src/features/observatory/panels.ts`: `PANEL_GROUPS` já declara os quatro grupos de § 4.4, **incluindo `activity`**, hoje sem nenhuma entrada — confirmado no comentário real do `inFlight`: *"not the persisted, historical sense of 'Atividade' this group's label suggests for later plans (O-2)"*, e no de `database`: *"the group has existed since O-1 with nothing in it (DO1.10: a group only shows once it has a panel)"*. `PanelGroupId` é `(typeof PANEL_GROUPS)[number]['id']` — adicionar uma entrada ao array não exige tocar tipo à parte.
- Nomenclatura confirmada por `ls`: painéis existentes seguem `NomePanel.tsx` + teste `nomePanel.test.tsx` — `EventsPanel.tsx`/`eventsPanel.test.tsx` segue o mesmo molde.
- § 5.1/§ 5.2 classificam "Eventos" como **Barato/Pesado** (§ 6): Barato = lê a cada abertura, sem `enabled: false` (diferente de Capacidades/Uso de disco, que são sob botão). Pesado = migração + store novo + instrumentação em caminho quente — exatamente o que este plano faz.
- `node:sqlite` (`DatabaseSync`, conferido via Context7/doc oficial do Node): `db.exec(sql)` para DDL, `db.prepare(sql).run(...params)` para INSERT/DELETE parametrizado — nunca interpolação de string — devolvendo `{ changes, lastInsertRowid }`.

## Decisões

### DO6.1 — Reaproveita `ipcStats.wrap`; nenhum segundo hook

O ponto de "operação IPC concluída" já existe, já mede `durationMs`, já distingue sucesso de erro, e já roda para **todo** canal (`handle()` embrulha todos). Criar um segundo mecanismo de captura duplicaria o `try/catch` que já está lá — e divergiria em silêncio na primeira vez que alguém esquecesse de atualizar os dois. § 3.2 pede "agrega-se na borda"; a borda certa é essa, não uma nova.

### DO6.2 — `core/` mede, `main/` grava; o sink é estado mutável do store, não argumento de construtor

`createIpcStatsStore` (`src/core/observatory/ipcStats.ts`) permanece puro — sem `node:sqlite`, sem `electron` — mas ganha um método `setEventSink(sink: (event: IpcCallEvent) => void): void`, guardando o callback numa variável `let eventSink` no escopo da fábrica. `record()` passa a chamar `eventSink?.({ channel, durationMs, error, domainId: extractDomainId(args) })` no fim, além do que já faz hoje. Como `record()` lê `eventSink` a cada chamada concluída (não no momento do `wrap`), a ordem de chamada de `setEventSink` só precisa acontecer antes do primeiro uso real do app — não precisa preceder o registro dos canais, embora `registerAll()` continue chamando-o logo após abrir `observatoryDb`, por clareza. `registry.ts` expõe `configureEventSink(sink)`, que delega a `ipcStats.setEventSink(sink)` no singleton já existente (sem recriar o `Map` de contadores — perderia as estatísticas do O-2). A função que faz o `INSERT` de fato — `recordEvent(db: DatabaseSync, event: IpcCallEvent): void` — mora em `src/main/observatory/events.ts`, não em `core/`: por convenção do repositório (`gc.ts` é o precedente), o arquivo que compõe I/O real sobre uma conexão que só o composition root abre fica em `main/`.

### DO6.3 — Um id de domínio por evento, nunca um `observationId` novo

Extração pura, testável sem I/O: `extractDomainId(args: unknown): string | null` em `src/core/observatory/events.ts`, checando `args` (um objeto, quando existir) pelas chaves `conversationId`, depois `messageId`, depois `jobId`, nessa ordem — a primeira presente vence. Cobre `conversation:*`/`draft:*` (`conversationId`), `conversation:removeMessage` (`messageId`, mais específico que o `conversationId` que a mesma chamada também carrega), e `dataset:attach`/`document:attach`/`image:attach`/`ai:chat`/`ai:propose` (`jobId`). Um canal sem nenhuma dessas chaves nos `args` (`app:info`, `session:cacheSize`…) grava `domain_id = NULL` — não é lacuna, é honesto: nem toda operação tem um dono de domínio (§ 3.5).

### DO6.4 — Retenção: intervalo fechado no schema Zod, sem "nunca apagar"

`eventRetentionDays?: number` entra em `appSettingsSchema` como `z.number().int().min(7).max(90).optional()` — o teto e o piso não são preferência de UX, são decisão de segurança contra um banco que cresce sem limite (§ 3.2 item ③; discutido e fechado com o usuário nesta sessão). Sem entrada em `DEFAULT_APP_SETTINGS`, seguindo o precedente exato de `lastExportDir`: o valor chega `undefined` de `readSettings` até o usuário escrever um; quem consome (`main/observatory/retention.ts`) resolve o default (30) no próprio ponto de leitura.

### DO6.5 — A varredura de retenção espelha `collectOrphanedAttachments`, sem inventar mecanismo novo

`sweepExpiredEvents(db: DatabaseSync, retentionDays: number, now: () => number = Date.now): Promise<void>` roda `DELETE FROM events WHERE created_at < ?` sobre o índice em `created_at`, chamada dentro de `registerAll()` com `.catch(() => {})`, mesmo molde de `await collectOrphanedAttachments(db, attachmentsDir).catch(() => {})`. Falha silenciosa de propósito: uma varredura de manutenção que derrubasse o boot do app por causa de uma linha antiga seria pior que não podar uma vez.

### DO6.6 — O painel entra no grupo `activity`, primeira ocupação real do grupo

`PANEL_GROUPS` já reserva `activity` desde o O-1 (mesmo raciocínio de DO1.10: um grupo só aparece na sidebar quando tem painel). `ActivityPanel` (id `inFlight`) fica em `state` de propósito — lê contadores ao vivo, sem histórico, como o próprio comentário do arquivo já registra. "Eventos" é o oposto: é exatamente o sentido persistido que o rótulo "Atividade" promete. Entra como `{ id: 'events', group: 'activity', label: 'Eventos', Panel: EventsPanel }`, único item do grupo até O-7/O-8.

### DO6.7 — Transparência sobre retenção em dois lugares, textos curtos e fixos

Decisão de UX fechada com o usuário nesta sessão, implementada sem variação: (a) junto ao controle numérico de retenção em Configurações — *"Eventos mais antigos que isso são apagados automaticamente, sem recuperação."*; (b) no cabeçalho do painel Eventos — *"Mostrando eventos dos últimos N dias — o resto já foi descartado."*, com `N` = `eventRetentionDays ?? 30` lido da mesma `AppSettings` que Configurações já expõe via `settings:read`. Não é um canal novo — o painel já precisa ler `AppSettings` para montar o próprio cabeçalho. Satisfaz § 4.3 regra 6: o painel nunca finge que "só há N eventos" por acaso — diz que podou.

### DO6.8 — Um canal novo só: `events:list`, sem `Result`; nenhum canal para escrever

A escrita nunca passa por IPC — acontece dentro do processo main, no sink da DO6.2 — então não existe (nem faria sentido existir) um `events:write`. `events:list` é `z.void()` → `EventRow[]`, **sem** `Result`: segue o mesmo precedente de `database:info` — "leitura de um banco já aberto pelo composition root, sem modo de falha que a UI precise distinguir" (DO3.3, skill `ipc`). `ORDER BY created_at DESC LIMIT 200`, sem paginação nesta primeira entrega — 200 já cobre a janela útil de um painel de depuração; paginação real é candidato a refinamento futuro, não bloqueio deste plano.

### DO6.9 — Duas correções da revisão do advisor, achadas antes do teste ao vivo

Nenhuma muda o escopo — as duas fecham um caso que o `check:fast` (testes automatizados) não conseguia pegar, porque exigem observar o *comportamento em uso*, não o dado isolado:

- **Auto-instrumentação.** Sem exclusão, abrir o painel Eventos dispararia `events:list`, que o sink gravaria como mais um evento concluído — o painel instrumentaria a si mesmo, e cada abertura empurraria sua própria leitura para o topo da lista que acabou de buscar. O sink em `registerAll()` agora ignora o canal `events:list`.
- **A janela de retenção precisa ser verdadeira no momento da leitura, não só no boot.** `sweepExpiredEvents` só roda uma vez, ao iniciar o app — se o usuário reduzisse `eventRetentionDays` de 90 para 7 em Configurações, o cabeçalho do painel (DO6.7(b)) passaria a dizer "últimos 7 dias" enquanto `events:list` continuava devolvendo linhas de até 90 dias atrás, porque a varredura física só rodaria no próximo boot. `listEvents` agora recebe `retentionDays` e filtra `WHERE created_at >= cutoff` na própria leitura — a varredura do boot continua existindo (ela é quem de fato libera espaço em disco), mas o texto de transparência do painel passa a ser verdadeiro por construção, não por coincidência de quando o app foi reiniciado pela última vez.

Consequência mecânica: `EventRow` ganhou `id` (chave estável de linha no React, em vez de índice de array — `key={index}` reordena/reusa DOM entre fetches diferentes, o que é exatamente o tipo de bug que só aparece ao vivo, nunca num teste que monta uma vez).

### DO6.10 — O sink também enxerga `Result.ok:false`, não só exceção — achado no teste ao vivo

O teste ao vivo (item 4 do roteiro) matou o Ollama e mandou uma mensagem: **nenhuma linha de erro apareceu**, nem no painel Eventos nem no contador em memória "Canais IPC" (O-2). Causa raiz: `ai:chat` (como todo canal que a skill `ipc` classifica como "falha esperada") **nunca lança** — ele resolve `Promise<Result<ChatReply>>`, e uma falha vira `{ ok: false, error: AppError }` no valor resolvido, não uma rejeição. O `try/catch` de `ipcStats.wrap` só via o `catch`, então a maioria das falhas visíveis ao usuário (provedor fora do ar, job cancelado) nunca chegava ao sink — só bug de programação (schema zod rejeitado) lançaria de verdade.

Conserto: `resultError(value): string | null` (`core/observatory/events.ts`) reconhece a forma `{ ok: false, error: { kind } }` e devolve o `kind` como string. `wrap()` passa a chamar **dois** caminhos separados após `fn(args)` resolver — `record()` (contador `AppIpcStat` do O-2, que continua contando só exceção, sem mudar DO2.4) e `emitEvent()` (sink do O-6, que agora usa `resultError(result) ?? null` mesmo quando não houve exceção). Os dois nunca foram a mesma coisa: o contador de O-2 responde "a infraestrutura quebrou?", o log de eventos de O-6 responde "a operação deu certo?" — e são perguntas diferentes, com respostas diferentes para o mesmo `ai:chat` derrubado. Nenhum teste automatizado (`check:fast`) pegaria isso sozinho — só apareceu matando o Ollama de verdade e olhando o painel vazio onde uma linha era esperada.

## Passos

### 1. Schema e constante (`src/main/observatory/db/migrations.ts`)

`OBSERVATORY_DATABASE_FILE = 'observatory.db'` e `const v1: Migration = (db) => { db.exec(...) }` com:

```sql
CREATE TABLE events (
  id          INTEGER PRIMARY KEY,
  channel     TEXT    NOT NULL,
  duration_ms REAL    NOT NULL,
  error       TEXT,
  domain_id   TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX events_by_created_at ON events (created_at);
```

`migrations: readonly Migration[] = [v1]` exportado ao lado. Reusa o `Migration` type de `src/main/db/migrations.ts` (mesmo tipo, escada diferente) — não duplica a definição.

### 2. Extração pura e sink mutável (`src/core/observatory/events.ts`, `src/core/observatory/ipcStats.ts`)

`extractDomainId(args: unknown): string | null` (DO6.3) e `resultError(value: unknown): string | null` (DO6.10), nível 1, sem I/O. `createIpcStatsStore` ganha `setEventSink` (DO6.2), e `wrap()` chama dois caminhos após `fn(args)` resolver: `record()` (contador `AppIpcStat`/O-2, inalterado — só exceção conta como falha) e `emitEvent()` (sink do O-6, que usa `resultError(result)` além de exceção). Teste de nível 1: sink chamado uma vez por chamada concluída, sucesso, exceção e `Result.ok:false` alike; `domainId` correto para um `args` com `conversationId`, outro só com `jobId`, outro sem nenhum; um `Result.ok:false` vira evento com erro sem incrementar `errorCount` do `AppIpcStat`.

### 3. A gravação real (`src/main/observatory/events.ts`, `src/main/ipc/registry.ts`)

`recordEvent(db: DatabaseSync, event: IpcCallEvent): void` — um `INSERT` parametrizado, `created_at: Date.now()`. `registry.ts` ganha `configureEventSink(sink: (event: IpcCallEvent) => void): void`, delegando a `ipcStats.setEventSink(sink)`. Teste de nível 3 com `DatabaseSync(':memory:')` migrado pela escada nova — confirma que uma chamada bem-sucedida e uma que lança geram, cada uma, exatamente uma linha.

### 4. Retenção (`src/main/observatory/retention.ts`)

`sweepExpiredEvents(db, retentionDays, now)` (DO6.5), teste de nível 1 com fixture de linhas antigas/novas, e um segundo caso variando `retentionDays` (0 apaga tudo, 90 mantém a linha recente) — prova que o parâmetro não é decorativo.

### 5. Registro no boot (`src/main/ipc/register-all.ts`)

Abre `observatoryDb = openDatabase(join(app.getPath('userData'), OBSERVATORY_DATABASE_FILE), observatoryMigrations)`. Chama `configureEventSink(...)` logo em seguida — **corrigido na revisão do advisor (DO6.9):** o sink exclui o próprio canal `events:list` (`if (event.channel !== 'events:list') recordEvent(...)`), senão abrir o painel Eventos instrumentaria a si mesmo, e cada abertura empurraria sua própria leitura para o topo da lista que acabou de buscar. `handle('events:list', ...)` lê `retentionDays` **a cada chamada**, não uma vez no boot (mesma correção, DO6.9) — chama `sweepExpiredEvents(observatoryDb, retentionDays).catch(() => {})` no mesmo ponto onde `collectOrphanedAttachments` já roda. `observatoryDb.close()` entra na função devolvida por `registerAll()`, ao lado de `db.close()`/`duckdbWorker.kill()`.

### 6. Contrato, retenção em `AppSettings`, canal `events:list` (`src/shared/ipc.ts`, `src/preload/index.ts`, `test/api-mock.ts`)

- `appSettingsSchema` ganha `eventRetentionDays: z.number().int().min(7).max(90).optional()` (DO6.4) — sem entrada em `DEFAULT_APP_SETTINGS`.
- `EventRow = { id: number; channel: string; durationMs: number; error: string | null; domainId: string | null; createdAt: number }` — o `id` entrou na revisão do advisor (DO6.9), para o painel ter chave estável de linha em vez de índice de array.
- `argsSchema['events:list'] = z.void()`; `IpcContract['events:list'] = { args: void; result: EventRow[] }` (DO6.8).
- `Api`: `events: { list(): Promise<EventRow[]> }`.
- Preload: bloco `events` em `src/preload/index.ts` — conferir teto de 100 linhas depois de `pnpm format`.
- `test/api-mock.ts` ganha o bloco `events` (`satisfies Api` acusa qualquer esquecimento no `typecheck`).

### 7. Configurações — campo de retenção (`src/renderer/src/features/settings/Settings.tsx`)

`RetentionField`, mesmo molde de `ThreadsField` (`SegmentedField`, opções fixas — ex. `[7, 30, 90]`), com `hint` sendo o texto da DO6.7(a). `useSettings`/`setSettings` já existem, sem hook novo.

### 8. Painel Eventos (`src/renderer/src/features/observatory/EventsPanel.tsx`, `panels.ts`)

`useQuery(['events', 'list'], () => window.api.events.list())` — sem `staleTime` especial (Barato, herda o padrão de `DatabasePanel`/`EnginePanel`). Lê `AppSettings` para montar o cabeçalho da DO6.7(b). Tabela: canal, duração, erro (quando houver), id de domínio (quando houver), "há Xmin" via `formatAge` (já promovido a `shared/format.ts` no O-5). `panels.ts` ganha `{ id: 'events', group: 'activity', label: 'Eventos', Panel: EventsPanel }` (DO6.6).

### 9. Auto-conservação — corrigir `docs/plan/active/README.md`

O índice hoje descreve a trilha O como se só `O-1` existisse ("a trilha é gatilhada... O-2..O-8 ainda não têm arquivo"), mas O-2 a O-5 já foram implementados. Não é só acrescentar a entrada do O-6 — é **corrigir** o texto desatualizado para refletir O-1..O-5 implementados e O-6 em `active/`, seguindo a regra de auto-conservação do `CLAUDE.md` (nome/caminho que mudou de estado, grep antes de commitar).

## Verificação

- Nível 1: `src/core/observatory/events.test.ts` (`extractDomainId`, prioridade `conversationId > messageId > jobId`, `null` quando nenhuma chave presente), `src/core/observatory/ipcStats.test.ts` estendido (sink chamado uma vez por conclusão, `domainId` correto, ausência de sink não lança), `src/main/observatory/retention.test.ts` (linhas antigas somem, linhas dentro do prazo ficam, `retentionDays` variável).
- Nível 3: `src/main/observatory/events.test.ts` (`recordEvent`/`listEvents` contra `:memory:` migrado pela escada nova — uma chamada e uma falha geram uma linha cada).
- Nível 2: `eventsPanel.test.tsx` (`ViewState` loading/ready/error, cabeçalho com o texto da DO6.7(b) e o `N` certo, uma linha por evento mockado), campo de retenção coberto em `settings.test.tsx` existente.
- `pnpm typecheck` (os três projetos) e `pnpm check:fast`.
- Conferência ao vivo: `pnpm dev`, abrir o Observatório, ir a Eventos — confirmar que chamadas recentes aparecem; forçar uma falha de canal (ex. desligar o Ollama e disparar `ai:chat`) e confirmar que a linha de erro aparece com `error` preenchido; mudar a retenção em Configurações e confirmar que o texto do cabeçalho do painel muda de N; reiniciar o app e confirmar que a varredura não derruba o boot mesmo com o banco vazio na primeira execução.

## Fora do escopo deste plano

- **Desempenho por modelo** (O-7) — latência/tokens por modelo é uma tabela própria, instrumentação na borda de `ai:*`; não antecipada aqui mesmo sendo o mesmo banco físico.
- **Privacidade — o que saiu da máquina** (O-8) — store novo + nível por anexo (§ 3.4); não antecipado aqui.
- **`job:event` (stream de progresso/chunk)** — § 3.2 é explícita: nunca uma linha por token/chunk. Este plano só grava a **conclusão** da operação IPC, nunca o stream que a alimenta.
- **Veredito de proposta, nível de exposição por anexo, modelo/contexto por mensagem** (§ 3.4) — são registro inerente do `crivo.db`, não telemetria; nenhum dos três é gravado por este plano nem pertence a `observatory.db`.
- **Paginação real do painel Eventos** — a primeira entrega lê as últimas 200 linhas; "carregar mais"/filtro por canal fica para quando o uso real pedir.

## Diário de execução

| Data | Sessão | O que foi feito |
|---|---|---|
| 01/09/2026 | 1 | Escopo do O-6 fechado em conversa (fonte do evento = hook único em `ipcStats.wrap`, retenção configurável com intervalo fechado 7–90 dias, textos de transparência no cabeçalho do painel e em Configurações). Plano escrito e revisado pelo advisor (Opus) antes de codar — corrigiu o desenho do sink (setter mutável, não parâmetro de construtor) e o schema (sem `STRICT`/`AUTOINCREMENT`). Context7 confirmou a API do `node:sqlite`. **Todos os 8 passos implementados na mesma sessão**, um commit por passo (`63386c5`..`9371346`): schema, extração pura + sink, gravação real, retenção, wiring no boot, contrato IPC, campo em Configurações, painel Eventos. Segunda revisão do advisor, agora sobre o código, achou dois problemas visíveis em uso — auto-instrumentação do canal `events:list` e janela de retenção que só ficava verdadeira após um restart — corrigidos como DO6.9 (ver Decisões), mais `EventRow.id` para chave estável de linha no React. **Verificação ao vivo feita pelo usuário**, 7 itens do roteiro: 1, 2, 3, 5, 6 e 7 passaram de primeira; o item 4 (forçar falha do Ollama) revelou um problema real — nenhuma linha de erro aparecia, nem no painel Eventos nem no contador em memória de O-2. Causa raiz e conserto: DO6.10 (`resultError`, `wrap()` bifurcado em `record`/`emitEvent`). Reconfirmado com `pnpm check:fast`: 139 arquivos de teste, **1237 testes**, zero erros de lint. Item 4 do roteiro pendente de reteste pelo usuário após o conserto; os demais seis já fechados. Skills usadas: `architecture`, `ipc`, `data`, `testing`, `design-system`, `comments`. |
