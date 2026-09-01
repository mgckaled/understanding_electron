# O-7 — Desempenho por modelo: tokens/s decomposto em rede, prefill e decode

> Sétimo plano da trilha O. A fundamentação inteira é [`reference/observatory/README.md`](../../reference/observatory/README.md); este plano **aplica**, não repete. Toda referência a "§ n" é seção daquele documento — em especial `§ 9`, escrita na mesma sessão em que este plano nasceu, com o desenho já fechado com o advisor.

**Origem:** [`ROADMAP.md`](../../ROADMAP.md) § 1, linha 41, nomeia O-7 como *"desempenho por modelo"*, próximo corte depois do O-6 (`observatory.db`, set/2026). Sessão de 01/09/2026 levantou o corte contra o código real: `promptTokens`/`evalTokens` já são extraídos, uniformemente, dos três provedores (`ollama.ts`, `glm.ts`, `gemini.ts`) — nunca persistidos, nunca cronometrados.

**Entrega:** uma tabela nova em `observatory.db` (`performance_events`), instrumentação em `chat()` (`main/features/ai/handlers.ts`) que decompõe cada resposta em três fases por wall-clock (rede+prefill, decode) mais os três campos nativos do Ollama quando disponíveis (carga, prefill, decode reais), e um painel **Desempenho** (grupo `activity`) com resumo por `(service, model)` — n, tokens/s médio, mediana, p90 — agregado em `core/`, nunca mantido como segunda tabela.

## Contexto

`reference/observatory/README.md` § 2.5 já registrava a melhoria pretendida sobre o mill.tools: medir tokens/s, não segundos, porque segundos não sobrevivem a uma mudança no tamanho do prompt. O que a fundamentação de ago/2026 não sabia — só apareceu ao ler o fonte nesta sessão — é que a peça mais cara (extrair `promptTokens`/`evalTokens` dos três provedores) **já está pronta**: `ChatReply` carrega os dois campos desde que os adaptadores foram escritos, só nunca chegaram a um lugar que os guarde ou que meça quanto tempo cada resposta levou.

A primeira versão do desenho, discutida nesta sessão, somava rede+prefill+decode num bloco "observado" só, igual para os três provedores. O advisor Opus apontou o defeito: um bucket `(service, model)` que mistura carga fria do Ollama (~48–50 s, D9.3/`CLAUDE.md`) com prefill quente (~0,5 s) produz uma média que não descreve nenhum dos dois regimes — viola a própria regra do § 4.3 regra 6 ("métrica ausente não é zero") na sua forma mais sutil: não é uma métrica ausente, é uma métrica **contaminada** que parece completa.

A correção usa uma assimetria real entre provedores, não uma escolha de conveniência: só um provedor local tem fase de carga, e só o Ollama expõe o corte servidor-side entre prefill e decode (`load_duration`/`prompt_eval_duration`/`eval_duration`, nanossegundos, confirmados via Context7 na mesma linha `done:true` que `ollama.ts` já lê para os contadores). GLM e Gemini nunca vão ter essas três colunas preenchidas — não é lacuna de implementação, é o que os dois provedores respondem.

## Sondagem — o que a leitura encontrou

- `src/main/features/ai/providers/ollama.ts`, `glm.ts`, `gemini.ts`: os três resolvem `ChatFn` para `{ content: string; promptTokens?: number; evalTokens?: number }`. Nenhum omite o contrato — quando o contador não chega (stream cancelado antes do fim), o campo simplesmente não existe no objeto, nunca `0` (já é a disciplina "métrica ausente não é zero" aplicada por quem escreveu os adaptadores, antes de a trilha O existir).
- `src/core/ai/types.ts`: `ChatFn` recebe `onChunk?: (text: string) => void` como parte da assinatura — confirmado que os três adaptadores chamam `onChunk?.(piece)` **por pedaço recebido**, nunca em lote: `ollama.ts:209`, `glm.ts:95`, `gemini.ts:126`. `t₁` (primeiro chunk) é bem definido nos três.
- Chamada com `format` (usada por `runStructuredChat`, que alimenta `ai:propose`) nunca passa `onChunk` — `core/ai/chat.ts` mostra que `runStructuredChat` nem aceita esse parâmetro. `ai:propose` fica fora da decomposição por construção, não por exclusão manual.
- `src/main/features/ai/handlers.ts::chat()`: já é o ponto único de borda de `ai:chat` — cria o `AbortController` do job, monta `onChunk` que reenvia `chunk` ao renderer via `emit()`, chama `runChat`. Nenhuma marca de tempo existe hoje; `jobs.create`/`jobs.finish` cuidam só do registro de cancelamento (`main/jobs.ts`), sem medir duração.
- `src/main/features/ai/providers/ollama.ts:32-40` (`OllamaChatLine`): tipo hoje só declara `prompt_eval_count`/`eval_count` na linha final. O Context7 (`/ollama/ollama`) confirma que a mesma linha `done:true` já carrega `total_duration`, `load_duration`, `prompt_eval_duration`, `eval_duration` — todos em nanossegundos —, então acrescentar os três campos ao tipo e ao retorno da função de streaming (linhas ~213-220) não muda o formato de resposta HTTP nenhum, só o que o app lê dele.
- `src/main/observatory/db/migrations.ts` (O-6): `migrations: readonly Migration[] = [v1]` — escada de um degrau só até aqui. O-7 acrescenta `v2`, reaproveitando o mesmo `openDatabase()`/`Migration` type; `observatory.db` já é aberto e fechado por `register-all.ts` (O-6), sem tocar o ciclo de vida.
- `src/main/observatory/events.ts`/`retention.ts` (O-6): `recordEvent`/`listEvents`/`sweepExpiredEvents` seguem o mesmo molde — `INSERT` parametrizado, `SELECT ... WHERE created_at >= cutoff`, `DELETE FROM ... WHERE created_at < cutoff` — que O-7 replica para a tabela nova, em vez de inventar mecanismo.
- `src/renderer/src/features/observatory/panels.ts`: grupo `activity` já existe (nasceu no O-6 com o painel Eventos); Desempenho é o segundo inquilino do grupo.
- `AppSettings.eventRetentionDays` (O-6, DO6.4): intervalo fechado 7–90 dias, já configurável em Configurações. A pergunta que este plano resolve é se Desempenho **reusa esse campo** ou ganha o próprio — decidida abaixo (DO7.6).

## Decisões

### DO7.1 — Três marcas de tempo por wall-clock, não os campos nativos como métrica primária

`t₀` antes de `runChat`, `t₁` no primeiro `onChunk`, `t₂` na resolução da promessa. `ttftMs = t₁ − t₀`, `decodeMs = t₂ − t₁`, `tokensPerSec = evalTokens ÷ (decodeMs / 1000)`. Funciona igual nos três provedores porque depende só do contrato já uniforme de `ChatFn`, nunca de um campo que só um provedor expõe. Alternativa descartada: usar `eval_duration` do Ollama como o `decodeMs` "oficial" e só o wall-clock para os demais — misturaria unidade de relógio diferente (servidor vs. processo main) na mesma coluna sem necessidade, já que o wall-clock local já é preciso o bastante para a escala em jogo (dezenas de ms a minutos).

### DO7.2 — Campos nativos do Ollama entram como colunas extras, não como segunda métrica de decode

`loadDurationMs`, `promptEvalDurationMs`, `nativeEvalDurationMs` (nomes provisórios — fecham na implementação) ficam `NULL` para GLM/Gemini, nunca `0`. O painel usa esses três só quando presentes, para separar "carga" de "prefill" dentro do bloco `ttftMs` de uma linha Ollama — `redeMs (estimado) = ttftMs − loadDurationMs − promptEvalDurationMs` quando os dois últimos existem; senão `ttftMs` fica indiviso, rotulado "rede+prefill". Isso resolve o defeito apontado pelo advisor: carga fria e prefill quente nunca mais caem no mesmo número.

### DO7.3 — Tabela própria, não uma coluna a mais em `events` (O-6)

`events` (O-6) já grava `ai:chat` como linha genérica de IPC via `ipcStats.wrap`, com `durationMs` do canal inteiro. Reaproveitar essa linha para carregar tokens e fases seria a mesma dívida de fonte única que vale para coluna, não só para documento — `ipcStats.wrap` embrulha **todo** canal, sem saber o que é uma resposta de chat. `performance_events` nasce como tabela irmã, mesma migração (`v2` na escada do O-6), população em ponto diferente: dentro do próprio `chat()`, não no `wrap()` genérico.

### DO7.4 — Só registra quando `evalTokens` chega, nunca fabrica linha parcial

Cancelamento, timeout, erro de provedor ou chamada `format`-constrained (`ai:propose`) não geram linha: `evalTokens` nunca existe nesses casos (§ regra "métrica ausente não é zero" do § 4.3), e uma linha com `tokensPerSec: 0` mentiria pior que a ausência da linha. O painel mostra o resumo do que **completou**, e a contagem `n` por bucket já comunica quantas respostas terminaram — não precisa de uma segunda coluna "quantas falharam" que já está no painel Eventos (O-6) e no Canais IPC (O-2), sob o mesmo `domainId`/`jobId` quando alguém quiser cruzar.

### DO7.5 — `performance:list` devolve o resumo já agregado; a linha crua nunca sai do main

`core/observatory/performance.ts` expõe uma função pura `summarizeByModel(rows: PerformanceRow[]): PerformanceSummary[]` — `n`, `avgTokensPerSec`, `medianTokensPerSec`, `p90TokensPerSec`, por bucket `(service, model)`. O handler de `performance:list` lê as linhas cruas dentro da janela de retenção (`listPerformanceEvents`, mesma disciplina de `events:list`), aplica `summarizeByModel` e devolve **só** o resultado agregado (`PerformanceSummary[]`, Passo 8) — a tabela crua nunca atravessa o IPC, mesmo padrão de `dataset:profile` (processa no main, devolve resultado pronto). Alternativa descartada: manter uma tabela `performance_summary` atualizada por trigger ou recomputada a cada `INSERT` — reintroduziria o problema que "derive, nunca liste" (§ 4.3 regra 5) existe para evitar, e o volume de linhas (uma por resposta de chat completa, numa máquina de um usuário só) nunca justifica a complexidade.

### DO7.6 — Retenção reaproveita `eventRetentionDays`, com o texto de Configurações ampliado

`performance_events` cresce mais devagar que `events` (uma linha por resposta de chat completa, não por canal IPC qualquer) — não há motivo para o usuário configurar duas janelas de retenção que, na prática, respondem à mesma pergunta ("por quanto tempo o Observatório guarda histórico?"). A varredura (`sweepExpiredPerformanceEvents`) roda com o mesmo `retentionDays` de `AppSettings`, no mesmo ponto do boot em que `sweepExpiredEvents` (O-6) já roda.

**Consequência que o O-6 não previa, e que este plano corrige:** o texto de `RetentionField` em Configurações (DO6.7(a)) diz hoje *"Eventos mais antigos que isso são apagados automaticamente, sem recuperação."* — depois deste plano, o mesmo campo também poda desempenho, e a palavra "Eventos" passaria a mentir por omissão de escopo. O texto muda para *"Dados do Observatório mais antigos que isso são apagados automaticamente, sem recuperação."*, cobrindo as duas tabelas sem nomear cada uma. O painel Desempenho ganha o mesmo cabeçalho de transparência que o painel Eventos já tem (DO6.7(b)) — ver Passo 9. Se o uso real mostrar que as duas tabelas merecem prazos diferentes, um campo próprio é acréscimo futuro, não uma antecipação sem sinal.

### DO7.7 — `performance:list` entra na mesma exclusão do sink que `events:list`

O sink de eventos (DO6.9) já ignora o canal `events:list` para o painel não se auto-instrumentar. `performance:list` é um segundo canal só-leitura do mesmo tipo: abrir o painel Desempenho não geraria linha na própria `performance_events` (que só grava em `chat()`, não em leituras), mas geraria uma linha no painel **Eventos** (O-6) a cada abertura, como qualquer outro canal IPC. A exclusão de `events:list` no sink (`main/ipc/register-all.ts`) ganha `performance:list` ao lado — mesma lista, mesma regra, para não precisar decidir de novo a cada canal de leitura do Observatório que nascer depois.

### DO7.8 — `tokensPerSec` mede a partir do segundo pedaço; o primeiro fica de fora do numerador tanto quanto do denominador

`t₁` marca a chegada do **primeiro** `onChunk` — o texto desse pedaço já teria sido gerado antes de `t₁`, mas seus tokens entram no `evalTokens` total (contado pelo provedor no fim, não por pedaço). Dividir o total inteiro por `t₂ − t₁` superestima o throughput, e o viés cresce quanto mais curta a resposta (um caso de poucos tokens em dois pedaços pode produzir um tok/s de quatro dígitos e distorcer a média do bucket). Guarda-se contra `decodeMs` perto de zero (mesma família do guard de mediana de um ponto só, Passo 6) — mas o viés sistemático fica para a verificação ao vivo decidir: o Ollama expõe `eval_count ÷ eval_duration` como taxa nativa na mesma chamada, e comparar contra o wall-clock numa resposta curta e numa longa decide se a fórmula fica como está ou se o pedaço inicial sai do numerador também.

## Passos

### 1. Schema (`src/main/observatory/db/migrations.ts`)

`v2: Migration` acrescentado ao array `migrations`, ao lado de `v1` (O-6):

```sql
CREATE TABLE performance_events (
  id                       INTEGER PRIMARY KEY,
  service                  TEXT    NOT NULL,
  model                    TEXT    NOT NULL,
  eval_tokens              INTEGER NOT NULL,
  ttft_ms                  REAL    NOT NULL,
  decode_ms                REAL    NOT NULL,
  load_duration_ms         REAL,
  prompt_eval_duration_ms  REAL,
  native_eval_duration_ms  REAL,
  created_at               INTEGER NOT NULL
);
CREATE INDEX performance_events_by_created_at ON performance_events (created_at);
```

Sem `STRICT`/`AUTOINCREMENT`, mesma convenção do `v1` (DO6, § schema).

### 2. Provedor Ollama expõe os três campos nativos (`src/main/features/ai/providers/ollama.ts`)

`OllamaChatLine` ganha `load_duration?: number`, `prompt_eval_duration?: number`, `eval_duration?: number` (nanossegundos); o retorno do laço de streaming (linhas ~213-220) espalha os três para o `ChatReply`, convertidos para ms (`/ 1e6`), só quando presentes — nunca `0`.

### 3. `ChatReply` ganha os campos opcionais (`src/shared/ipc.ts`)

`loadDurationMs?`, `promptEvalDurationMs?`, `nativeEvalDurationMs?` ao lado de `promptTokens?`/`evalTokens?` — sem schema zod (mesma regra de `promptTokens`/`evalTokens`: saída do main, nunca validada, D2.6).

### 4. Cronometragem isolada de `chat()` (`src/main/observatory/chatTiming.ts`, novo)

⚠️ **`main/features/ai/handlers.ts` já tem 160 linhas — acima do teto de 150 para handler de `main/features/` (`CLAUDE.md`, régua de tamanho).** Este plano é o próprio gatilho de "divide-se ao tocar": a cronometragem **não** entra dentro de `chat()`. `measureChatTiming(runChat, args, opts): Promise<{ reply: ChatReply; ttftMs: number; decodeMs: number } | { reply: ChatReply }>` embrulha a chamada a `runChat` — marca `t0` antes, embrulha `onChunk` para marcar `t1` no primeiro pedaço, marca `t2` depois da resolução — e devolve as marcas só quando `t1` foi de fato setado (guarda contra `format`/stream de um pedaço só). `chat()` em `handlers.ts` passa a chamar essa função em vez de `runChat` direto — troca de uma linha, sem crescer.

### 5. Gravação e leitura (`src/main/observatory/performance.ts`)

`recordPerformanceEvent(db, event): void` — `INSERT` parametrizado, mesmo molde de `recordEvent` (O-6), chamado por `chat()` quando `measureChatTiming` devolve as marcas **e** `reply.evalTokens !== undefined`. `listPerformanceEvents(db, retentionDays, now)`, mesmo molde de `listEvents`.

### 6. Agregação pura (`src/core/observatory/performance.ts`)

`summarizeByModel(rows: PerformanceRow[]): PerformanceSummary[]` (DO7.5) — agrupa por `(service, model)`, calcula `n`, média, mediana e p90 de `evalTokens ÷ (decodeMs/1000)` por linha antes de agregar. Nível 1, sem I/O — fixture de linhas cruas, incluindo um bucket com `loadDurationMs`/`promptEvalDurationMs` presentes (Ollama) e outro sem (GLM/Gemini), provando que o resumo não quebra nem finge dado que não existe.

### 7. Retenção (`src/main/observatory/retention.ts`)

`sweepExpiredPerformanceEvents(db, retentionDays, now)` ao lado de `sweepExpiredEvents`, chamado no mesmo ponto do boot (DO7.6). `main/ipc/register-all.ts`: a exclusão do sink de eventos (DO6.9) ganha `performance:list` ao lado de `events:list` (DO7.7). Texto de `RetentionField` em `src/renderer/src/features/settings/Settings.tsx` atualizado para *"Dados do Observatório mais antigos que isso são apagados automaticamente, sem recuperação."* (DO7.6).

### 8. Contrato IPC (`src/shared/ipc.ts`, `src/preload/index.ts`, `test/api-mock.ts`)

`PerformanceSummary` (tipo puro, sem schema zod, mesma regra de `EventRow`/`ColumnProfile`). `argsSchema['performance:list'] = z.void()`; `IpcContract['performance:list'] = { args: void; result: PerformanceSummary[] }`, sem `Result` (mesmo precedente de `events:list`/`database:info` — leitura sem modo de falha que a UI precise distinguir). `Api.performance.list()`. Preload e mock atualizados.

### 9. Painel Desempenho (`src/renderer/src/features/observatory/PerformancePanel.tsx`, `panels.ts`)

`useQuery(['performance', 'list'], () => window.api.performance.list())`, sem `staleTime` especial (Barato — mesmo padrão de `EventsPanel`). Tabela por `(service, model)`: n, tokens/s médio, mediana, p90, e — só quando `loadDurationMs` presente em pelo menos uma linha do bucket — uma segunda linha de detalhe mostrando o tempo médio de carga (Ollama). Cabeçalho de transparência igual ao de `EventsPanel` (DO6.7(b)): *"Mostrando o resumo das respostas dos últimos N dias — o resto já foi descartado."*, com `N` = `eventRetentionDays ?? 30` lido de `AppSettings` — o mesmo texto vale para as duas tabelas por causa da DO7.6. `panels.ts` ganha `{ id: 'performance', group: 'activity', label: 'Desempenho', Panel: PerformancePanel }`, segundo inquilino do grupo `activity` (o primeiro foi Eventos, O-6).

## Verificação

- Nível 1: `src/core/observatory/performance.test.ts` (`summarizeByModel` — n/média/mediana/p90 corretos contra fixture conhecida à mão; bucket sem campos nativos não quebra; bucket com um único ponto não divide por zero na mediana; `decodeMs` perto de zero não produz `Infinity`/`NaN` em `tokensPerSec`, DO7.8).
- Nível 1: `src/main/features/ai/providers/ollama.test.ts` estendido — resposta com `load_duration`/`prompt_eval_duration`/`eval_duration` na linha final propaga os três para `ChatReply` em ms; ausência dos três (versão antiga do Ollama, hipoteticamente) não quebra o parse.
- Nível 3: `src/main/observatory/performance.test.ts` (`recordPerformanceEvent`/`listPerformanceEvents`/`sweepExpiredPerformanceEvents` contra `:memory:` migrado pela escada com `v2`).
- Nível 2: `performancePanel.test.tsx` — `ViewState` loading/ready/vazio, uma linha por bucket mockado, a linha de carga só aparece quando o mock traz `loadDurationMs`.
- `pnpm typecheck` (os três projetos) e `pnpm check:fast`.
- Conferência ao vivo: `pnpm dev`, mandar uma mensagem de chat pelo Ollama e observar o painel Desempenho após a resposta terminar — confirmar `n: 1`, tokens/s plausível, e a linha de carga aparecendo (ou não, se o modelo já estava residente — carga baixa é um resultado válido, não um bug). Repetir com GLM/Gemini configurados (se a chave existir na máquina de teste) e confirmar ausência da linha de carga, nunca `0`. Cancelar uma resposta no meio e confirmar que nenhuma linha nova aparece. **Decidir DO7.8 com dado real:** mandar uma pergunta de resposta curta (poucos tokens) e uma de resposta longa pelo Ollama, comparar o `tokensPerSec` calculado por wall-clock contra `eval_count ÷ eval_duration` (taxa nativa, mesma chamada) — se a resposta curta divergir de forma relevante da nativa, ajustar a fórmula (tirar o primeiro pedaço do numerador) antes de fechar o plano; se as duas track dentro de poucos pontos percentuais, a fórmula fica como está. Abrir o painel Desempenho repetidas vezes e confirmar, no painel Eventos, que `performance:list` não aparece como linha (DO7.7).

## Fora do escopo deste plano

- **Privacidade — o que saiu da máquina** (O-8) — reaproveita o mesmo ponto de instrumentação em `chat()`, mas é plano próprio (§ 9.4): dimensão, retenção e forma de agregação diferentes.
- **Decompor "rede" de "prefill" nos provedores de nuvem** — GLM/Gemini não expõem esse corte; o bloco `ttftMs` fica indiviso para os dois, permanentemente, não como lacuna temporária.
- **Gráfico de série temporal** (tokens/s ao longo do tempo, por modelo) — a primeira entrega é resumo agregado; série temporal é candidato a refinamento futuro se o uso real pedir.
- **Instrumentar `ai:propose`** — chamadas `format`-constrained nunca streamam, então nunca têm `t₁`; ficam fora por construção, não por exclusão a revisitar.

## Diário de execução

| Data | Sessão | O que foi feito |
|---|---|---|
| 01/09/2026 | 1 | Escopo de O-7 (e O-8) levantado em conversa, contra o código real em vez da fundamentação de ago/2026: achado que `promptTokens`/`evalTokens` já são extraídos uniformemente dos três provedores, nunca persistidos nem cronometrados. Seis skills invocadas (`architecture`, `ipc`, `data`, `design-system`, `testing`, `comments`); Context7 (`/ollama/ollama`) confirmou os três campos nativos de duração na mesma linha `done:true` que o app já lê; busca web sobre livros-razão de privacidade em apps local-first não trouxe padrão citável, descartada. Primeiro desenho (tokens/s "observado" único) revisado pelo advisor Opus e corrigido: decomposição em três marcas de wall-clock (`t₀`/`t₁`/`t₂`) uniforme nos três provedores, mais os três campos nativos do Ollama como colunas extras nunca fabricadas para os demais. Segunda revisão do advisor, sobre o plano escrito, achou quatro defeitos bloqueantes antes de qualquer código: número stale no `ROADMAP.md` (dois lugares diziam tamanhos diferentes de `DECISOES.md`), `handlers.ts` já acima do teto de 150 linhas sem o plano prever a divisão, DO7.5 se contradizendo com o Passo 8 sobre o que o canal devolve, e retenção compartilhada sem atualizar o texto que ela já invalida (DO6.7(a)) nem dar cabeçalho de transparência ao painel novo — todos corrigidos no mesmo plano (DO7.5 reescrita, DO7.6 ampliada, DO7.7/DO7.8 novas, Passo 4 isolado em `chatTiming.ts`). Um quinto ponto (viés do `tokensPerSec` por excluir o primeiro pedaço do numerador) ficou para a verificação ao vivo decidir com dado real, não resolvido por antecipação. `docs/DECISOES.md` ganhou a tabela da trilha O (55 linhas, seis planos, grep dos headings verbatim) — manutenção sem plano próprio; registra-se aqui para subir ao `HISTORY.md` junto do marco do O-7 quando ele for implementado, não como entrada isolada. `docs/reference/observatory/README.md` ganhou a § 9 com o desenho fechado, incluindo a reconciliação entre § 3.4 (nível por anexo ainda não gravável) e § 9.3 (o tipo do anexo como proxy disponível hoje). Plano escrito; implementação ainda não começou. |
