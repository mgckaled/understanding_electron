# 18-B — Canal, Arrow e a primeira consulta visível

**Depende de:** [18-A — Motor: instalação, endurecimento e a primeira travessia de processo](18-A-motor-e-worker.md) · **Entrega:** o canal `dataset:query`, transporte em bytes Arrow (montados em JS — ver D18B.1), uma UI mínima de SQL cru dentro do `DatasetCard` já existente, e a medição real JSON-contra-Arrow que o `study/05` pedia e nunca tinha número.

> Segundo dos sub-planos do 18. O 18-A provou que o motor sobe e atravessa `main`↔`worker`, sem canal e sem UI (D18A.5). Este plano é onde isso vira algo que um usuário consegue apertar um botão e ver.

**Fora deste plano:** pré-visualização automática de 50 linhas (18-C) · perfil nível 2 sob demanda + cartão aninhado (18-D) · Parquet/JSON/NDJSON (18-D–E) · Excel (18-F).

---

## Contexto

O `study/05-proximos-passos.md` descreve a etapa 5 da sua ordem sugerida como "trocar o retorno de JSON para `ArrayBuffer` transferível... com o número surpreendendo". A pesquisa desta sessão mudou a premissa por trás dessa frase: **`@duckdb/node-api` não expõe exportação Arrow nativa** — é uma [issue aberta no próprio repositório](https://github.com/duckdb/duckdb-node-neo/issues/45), sem prazo, sem workaround documentado. O `study/05` assumia (por analogia com o cliente Python, que tem `.arrow()`/`to_arrow_reader()`) que "os dados saem no formato final" — não saem, para este binding. O que o `@duckdb/node-api` devolve é dado JS nativo (`getColumnsObject()`, `getRows()`), e o Arrow precisa ser **construído** a partir disso, em JS, via `apache-arrow`.

Isso não invalida a decisão por Arrow — só muda onde o custo mora. Antes: "o motor produz Arrow de graça, só falta transportar". Agora: "o worker monta uma `Table` do `apache-arrow` a partir de colunas JS, serializa, e só *depois* disso o transporte binário economiza sobre JSON". O passo 5 (medição) existe justamente para não deixar essa suposição corrigida virar uma suposição nova sem número atrás dela.

---

## Decisões

### D18B.1 — Arrow montado em JS no worker, não recebido pronto do motor

Alternativa considerada e descartada: falar direto com `@duckdb/node-bindings` (a camada N-API por baixo do `@duckdb/node-api`), que pode ter acesso à API C de Arrow do próprio DuckDB (`duckdb_query_arrow` e afins, mencionada como parte do C API que o `node-api` ainda não expõe por completo — a issue #45 está sob o marco "C API Parity"). Descartado porque `node-bindings` não é documentado para uso direto — é a camada interna que `node-api` estabiliza, e contorná-la contradiz o motivo declarado da escolha por N-API (estabilidade entre versões, sem recompilação). O caminho escolhido: `reader.getColumnsObject()` (já confirmado no 18-A/pesquisa da sessão anterior) devolve `{ coluna: valores[] }`; `core/duckdb/arrow.ts` usa `tableFromArrays` do `apache-arrow` para montar a `Table` e `tableToIPC` para serializar. Gatilho de revisão explícito no `ROADMAP § 2`: se a issue #45 fechar, reavaliar — pode eliminar um passo de conversão inteiro.

### D18B.2 — SQL cru restrito a somente-leitura, e a guarda é sintática, não a fronteira real

O verbo que este plano prova é *perguntar* (`ESCOPO.md`) — uma consulta, não uma lista de passos que muda dado. `core/duckdb/query.ts` rejeita qualquer entrada que, após `trim`, não comece por `SELECT`/`WITH` (case-insensitive) **ou** que contenha um `;` além de um único opcional no fim — sem o segundo critério, `SELECT 1; DROP VIEW dataset;` passaria no prefixo e executaria um segundo statement se a conexão rodar múltiplos por chamada. **Isto é defesa sintática, best-effort — não a fronteira real.** A fronteira real é o motor restrito da D18A.3 (`enable_external_access = false`, `lock_configuration = true`): mesmo que a guarda tenha um furo não previsto, o motor não alcança disco fora de `allowed_directories` nem muda configuração travada. A guarda existe para dar erro cedo e claro (`invalidQuery`, D18B.6), não para ser a única coisa entre o usuário e o motor.

### D18B.3 — A consulta roda contra uma *view* por hash; o caminho é resolvido **no worker**, não no main — correção sobre o rascunho original, feita ao ler o código real do 18-A

`core/duckdb/query.ts` monta `CREATE OR REPLACE VIEW dataset AS SELECT * FROM read_csv_auto(<caminho>)`. **O rascunho original desta decisão dizia que o caminho seria resolvido no main — errado, e corrigido antes de qualquer código deste plano existir.** `workers/duckdb/index.ts` (18-A, real) já computa `attachmentsDir = join(userDataPath, 'attachments')` no próprio `main()` do worker, a partir do argumento de `fork()` — é o worker, não o main, que tem esse caminho em escopo. Resolver no main duplicaria esse cálculo nos dois processos, para nenhum ganho.

**Divisão de responsabilidade, então:** o **main** só valida o **formato** do hash (regex, abaixo) antes de gastar um round-trip de IPC com entrada obviamente inválida — validação de forma, não resolução de caminho, e **o handler no main nunca calcula `attachmentsDir`** — não tem motivo para conhecer esse diretório, só o hash. O **worker** resolve `join(attachmentsDir, hash)` e monta a *view* — ele já tem `attachmentsDir` (fonte única em runtime, `workers/duckdb/index.ts`), e é ele quem detém a conexão viva com o DuckDB (D18B.3-bis, abaixo). `core/duckdb/query.ts` continua puro e testável em nível 1 nos dois casos: o teste supre `attachmentsDir` como qualquer outro parâmetro, sem precisar de um runtime real atrás dele.

**Consequência que muda D18B.6:** `runQuery` precisa do `hash`, não só do SQL final — é o worker quem cria a *view* antes de rodar a consulta, e criar a *view* exige saber de qual arquivo.

### D18B.3-bis — Uma conexão só, para a vida do worker — fato confirmado, não mais suposição

`workers/duckdb/index.ts` (18-A) cria **uma** `DuckDBInstance`/`connection` no arranque do worker e a reutiliza em todo `on('message')` subsequente — não uma conexão por pedido. Isso deixa de ser a incerteza que obrigou o 18-D a escrever "se o 18-B mantiver essa forma... se abrir uma conexão por pedido...": **é essa forma, confirmada no código real.** Consequências diretas: (1) a *view* de um hash, uma vez criada, sobrevive entre pedidos — recriá-la a cada `dataset:query` (`CREATE OR REPLACE`) é barato porque é metadado, não porque "poderia não persistir"; (2) o worker é **spawnado uma vez** (`spawnDuckdbWorker`, D18A, já existe e já faz o encaminhamento de `stdout`/`stderr`) e mantido vivo pelo `register-all.ts` — não um `utilityProcess.fork()` por consulta; (3) como a UI (D18B.5) só permite uma consulta em voo por vez (um botão Executar, um resultado), `runQuery` não precisa de id de correlação — manda a mensagem, espera o próximo `'message'`, resolve. Se um dia existir consulta concorrente (dois cartões consultando ao mesmo tempo), isso muda — não é o caso hoje.

**O hash é validado contra `/^[a-f0-9]{64}$/` antes de tocar qualquer string SQL** — o mesmo guard que o protocolo `attachment://` já usa (D17.6); `zod`'s `z.string()` no `argsSchema` não impõe esse formato sozinho, então a validação vive em `core/duckdb/query.ts`, não só no schema. **O caminho entra como parâmetro vinculado (`connection.run(sql, values, types)`, já confirmado no `@duckdb/node-api`), não interpolado em texto** — se `read_csv_auto($1)` não aceitar parâmetro de função de tabela na prática (a confirmar ao vivo **no passo 3**, onde o worker de fato existe — o passo 1 é `core/`, puro, sem DuckDB rodando, não tem como confirmar nada ao vivo), a interpolação de string vira o plano B, mas só depois do hash validado pelo regex acima: nesse caso, o que entra na string nunca é texto livre do usuário, é um valor que já passou por um formato fixo de 64 caracteres hexadecimais.

**A criação da *view* e a consulta final são dois `connection.run()` separados no worker, nunca uma string com `;` juntando os dois.** É a mesma guarda da D18B.2 que rejeita `;` extra no SQL do usuário — se `runQuery(hash, sql)` concatenasse `CREATE OR REPLACE VIEW ...; <sql>` numa string só, o próprio caminho da aplicação teria criado o multi-statement que a D18B.2 existe para barrar no SQL do usuário. É a mesma classe de falha que o `HISTORY.md` já registra para validação colocada ao lado de um chamador só: vira bypass no segundo. `core/duckdb/query.ts` reflete isso na forma — `buildViewSql(hash, attachmentsDir)` e `buildFinalSql(sql, limit)` são **duas funções, duas strings**, nunca uma concatenada; o worker roda a primeira, depois a segunda.

### D18B.4 — Teto de 200 linhas via `LIMIT 201`, sem dependência de virtualização — e o embrulho é parametrizado, não fixo

`core/duckdb/query.ts` expõe `wrapWithLimit(sql, limit)`: `SELECT * FROM (<sql>) LIMIT <limit>`, mecânico, sem opinião sobre o valor. **Este canal chama com `limit = 201`** — se voltarem 201 linhas, a UI descarta a última e mostra "mostrando as primeiras 200 linhas": o truque de pedir N+1 para saber se havia mais, sem pagar um `COUNT` à parte, necessário aqui porque o SQL é livre e o total não é conhecido de antemão. 200 é o mesmo teto de DOM que o `CLAUDE.md` já fixa para qualquer tabela do app — escolhido de propósito para não precisar de virtualização nenhuma neste plano nem abrir a porta para trazer TanStack Virtual só por causa desta tela de diagnóstico. **A função ganha o parâmetro em vez do número fixo porque o 18-C precisa do mesmo mecanismo com `limit = 50` e sem o truque de N+1** — a pré-visualização já sabe a contagem total pelo `DatasetPart` (plano 16), então não paga a linha extra; decidir isso agora evita reabrir este arquivo depois (mesmo critério "caro de desfazer" da D18A.3).

### D18B.5 — A UI entra como seção recolhível dentro do `DatasetCard`, não uma tela nova

Um botão "Consultar" no `DatasetCard` (`features/attachment/DatasetCard.tsx`) abre uma seção recolhível — input de SQL, botão Executar, área de resultado — reaproveitando o padrão de "artefato recolhível" que o `ESCOPO.md` já descreve para a conversa inteira. Nenhuma tela nova, nenhuma rota nova.

**Achado ao conferir o código, não presumido:** `DocumentCard.tsx` (plano 17, D17.9) já implementa exatamente essa forma — `useState(false)` local + botão com `Chevron{Up,Down}` + render condicional — mas como estado **local ao componente**, sem abstração compartilhada. Este plano é a **segunda** ocorrência do mesmo padrão; o 18-D (perfil nível 2, cartão aninhado) será a **terceira**. Pela regra dos três que este projeto já aplicou (`mapFsError`, D17.2), a segunda ocorrência **não** extrai — copia a forma do `DocumentCard` (mesmo `useState`, mesmos ícones) sem criar componente novo. **Fica registrado para o 18-D**: na terceira ocorrência, extrair um `Disclosure`/`Collapsible` de `shared/ui/` deixa de ser prematuro e passa a ser a chamada certa — decisão do 18-D, não deste plano.

### D18B.6 — `AppError` ganha `invalidQuery`; handler testável via injeção, execução real não é nível 3

```ts
| { kind: 'invalidQuery'; message: string }
```

Cobre tanto a rejeição da D18B.2 (SQL não é leitura) quanto um erro real do DuckDB (coluna inexistente, sintaxe inválida) — o texto de `message` é o próprio erro do motor, útil por si só numa ferramenta de diagnóstico. Toca `errorMessage()` em `shared/ui/messages.ts` (skill `design-system`), forçado pelo `Record<ErrorKind, string>` — `pnpm typecheck` quebra até essa entrada existir.

O handler segue o mesmo padrão de injeção de `attachDataset` (D16.6): `queryDataset(args, runQuery)`, onde **`runQuery: (hash: string, sql: string) => Promise<Uint8Array>`** — o `hash` entra porque D18B.3 move a resolução de caminho e a criação da *view* para o worker, que precisa saber de qual arquivo antes de rodar a consulta final. (Correção sobre um rascunho anterior desta assinatura, que só levava `sql` — inconsistente com D18B.3, achada e fechada antes de qualquer código deste plano.) Isso mantém a **validação de formato de hash e a forma do `Result`** testáveis em nível 3 com um `runQuery` dublê — mas a implementação real de `runQuery` (que fala com o `utilityProcess` do 18-A, reaproveitando `spawnDuckdbWorker` já existente — D18B.3-bis) só se prova ao vivo, pela mesma razão da D18A.2/D18A.5: `utilityProcess` é API exclusiva do Electron.

---

## Passos

| # | Entrega | Testes | Aceite |
|---|---|---|---|
| **1** | `core/duckdb/query.ts` — guarda somente-leitura + rejeição de `;` extra (D18B.2), validação de formato de hash por regex, **duas funções separadas** — `buildViewSql(hash, attachmentsDir)` e `buildFinalSql(sql, limit)` (D18B.3/D18B.4) — nunca uma string concatenada; `buildViewSql` emite a forma parametrizada (`read_csv_auto($1)`) por padrão, com a forma interpolada sobre hash validado como alternativa no mesmo módulo, para o passo 3 escolher qual o motor aceita | Nível 1: SQL não-SELECT rejeitado; `SELECT 1; DROP VIEW dataset;` rejeitado pelo `;` extra; hash fora do formato rejeitado antes de montar SQL; `wrapWithLimit`/`buildFinalSql` testado com mais de um valor de `limit`; **as duas formas de `buildViewSql` (parametrizada e interpolada) testadas separadamente** — qual delas o motor aceita só se sabe no passo 3 | Testes verdes; nenhuma dependência de DuckDB ou Electron neste arquivo — **este passo não confirma nada ao vivo, é puro por natureza; a confirmação do parâmetro vinculado é critério de aceite do passo 3** |
| **2** | `core/duckdb/arrow.ts` — monta uma `Table` do `apache-arrow` a partir do formato colunar (`{ coluna: valores[] }`) e serializa com `tableToIPC` (D18B.1) | Nível 1, contra dados sintéticos — não precisa do DuckDB rodando para testar a conversão em si. **Round-trip para cada tipo que o sniffer do CSV de fato produz:** `BIGINT` (como `BigInt` em JS — o caso mais provável de quebrar, IDs numéricos grandes num CSV comum), `DOUBLE`, `VARCHAR`, `DATE`, `BOOLEAN`, coluna com `NULL` | `tableFromIPC(bytes)` devolve as mesmas colunas/valores que entraram, **para todos os seis tipos** — se `BigInt` não passar por `tableFromArrays` sem tratamento especial, este passo é onde isso se descobre, não o passo 4 ao vivo |
| **3** | Canal `dataset:query` de ponta a ponta — os seis pontos da skill `ipc` (`argsSchema`/`IpcContract`/`Api` com `AppError.invalidQuery`, handler `queryDataset` com `runQuery(hash, sql)` injetado — D18B.6 —, `register-all.ts` **remove a chamada a `probeDuckdbWorker` (D18A.5, scaffolding com prazo já vencido) e liga `runQuery` a um worker spawnado uma vez via `spawnDuckdbWorker` e mantido vivo** (D18B.3-bis), `preload/index.ts`, `test/api-mock.ts`) | Nível 3: handler com `runQuery` dublê — SQL rejeitado devolve `invalidQuery` sem chamar `runQuery`; SQL válido chama `runQuery(hash, sql)` com a consulta montada pelo passo 1 | Teste nível 3 verde; `pnpm typecheck` **quebra em `test/api-mock.ts` até o mock ganhar `dataset.query`** — é o sétimo ponto de toque anunciando a si mesmo (skill `ipc`), não um TODO a lembrar manualmente; **`register-all.ts` não chama mais `probeDuckdbWorker` em lugar nenhum** — checar por `grep`, não só por leitura; **confirma ao vivo se `read_csv_auto($1)` aceita a forma parametrizada de `buildViewSql`** (achado do passo 1 que só se prova aqui, onde o worker de fato existe) — se não aceitar, o worker usa a forma interpolada do mesmo módulo, sem reabrir `core/duckdb/query.ts` |
| **4** | Botão "Consultar" no `DatasetCard` abre a seção recolhível, forma copiada do `DocumentCard`/D17.9 (D18B.5): input de SQL, Executar, tabela de resultado via `tableFromIPC()` do `apache-arrow`, aviso de truncamento (D18B.4), erro via `errorMessage()` | Nível 2: SQL inválido mostra o erro; SQL válido mostra a tabela; 201 linhas mostram o aviso de truncamento | Fluxo completo verificado em nível 2; **ao vivo** (`pnpm dev`) contra um dataset já anexado de verdade |
| **5** | Medição JSON-contra-Arrow, **duas escalas rotuladas separadamente**: (a) no teto real do contrato hoje — 200 linhas — tempo de montar `Table`+serializar (D18B.1) vs `JSON.stringify(getRowObjects())`, cópia nas duas fronteiras de processo; (b) mesmo comparativo com o `LIMIT` temporariamente desligado, contra um fixture de ~100 mil linhas — número que **não** se aplica ao contrato de hoje, só informa se o cap valer a pena revisitar depois | — | Números de (a) e (b) registrados no diário, com metodologia, rotulados sem ambiguidade sobre qual vale para o canal atual. **Decisão presa ao resultado, não um encolher de ombros:** se Arrow perder em (a), a escolha continua sendo Arrow — os consumidores maiores do 18-C/18-D reusam o mesmo canal, e duas serializações coexistindo custa mais que a diferença de microssegundos num payload de 200 linhas; **só** se Arrow perder por margem grande também em (b) é motivo real para reabrir D18B.1 — e nesse caso a reabertura é o item de fechamento do passo 6, não um risco silencioso |
| **6** | Fechamento: diário; `HISTORY.md`/`study/05-proximos-passos.md` recebem a correção da D18B.1 (Arrow não é nativo neste binding) — achado que vale além deste plano, escalação obrigatória pela própria regra do `docs/README.md`; `ROADMAP § 2` ganha o gatilho "issue duckdb-node-neo#45 fechar" | — | `pnpm check:fast` verde; nada pendente de registro |

---

## Ordem de dependência

```
1 (guarda + consulta) ──┐
2 (Arrow em JS) ─────────┼──► 3 (canal) ──► 4 (UI) ──► 5 (medição) ──► 6 (fechamento)
```

1 e 2 são independentes entre si (nenhum usa o outro) e podem ser feitos em qualquer ordem ou no mesmo commit; 3 precisa dos dois. 5 precisa de 3 e 4 existirem de ponta a ponta para medir o caminho real, não um benchmark isolado.

---

## Riscos

1. ~~**`tableFromArrays` pode não inferir os mesmos tipos que o DuckDB usa internamente**~~ — **endereçado no passo 2**, não deixado como limitação conhecida: o teste de round-trip cobre os seis tipos que o sniffer do CSV de fato produz, incluindo `BigInt`, que é o caso mais provável de quebrar (regra do CSV: qualquer coluna de ID grande já aciona `BIGINT`). Se sobreviver algum tipo não coberto por esses seis (ex.: `TIMESTAMP` vindo de Parquet no 18-D), é risco novo daquele plano, não deste.
2. **A issue #45 pode fechar durante a execução deste plano ou logo depois** — se o `@duckdb/node-api` ganhar exportação Arrow nativa, o passo 2 inteiro (D18B.1) fica redundante. Não é motivo para atrasar; é motivo para o gatilho de `ROADMAP` existir.
3. **O teto de 201 linhas assume que `LIMIT` aplicado sobre uma subconsulta arbitrária do usuário sempre funciona** — verdadeiro para SQL padrão, mas uma consulta do usuário com seu próprio `ORDER BY`/`LIMIT` interno pode se comportar de um jeito que só aparece testando ao vivo (passo 4).

---

## Verificação

- `pnpm check:fast` depois de cada passo.
- `pnpm dev` ao vivo no passo 4 — anexar um dataset de verdade, rodar uma consulta válida e uma inválida, confirmar o aviso de truncamento com uma consulta que devolve mais de 200 linhas.
- O passo 5 roda contra um fixture real, não sintético — mesma disciplina que o `study/05` já pedia para a medição de Arrow, e que a D18B.1 tornou ainda mais necessária.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 19/08/2026 | 1–6 | **concluído** — plano fecha e move para `implemented/` | Sondagem ao vivo (script descartável) respondeu **antes** de escrever o worker final as duas perguntas que o passo 3 deixava abertas. `buildViewSqlParameterized` foi removida por não ter chamador real — código morto achado na revisão. A medição do passo 5 tinha dois vieses a favor do JSON na primeira rodada (o *pivot* colunas→linhas fora do cronômetro; colunas de texto 100% únicas, pior caso para o dicionário do Arrow); **corrigidos os dois, a direção não mudou**. Decisão presa ao resultado como o plano definiu antes de medir: Arrow continua sendo a escolha do canal, com gatilho de reabertura registrado. |
| 18/08/2026 | — | plano corrigido contra o 18-A **implementado** | Checagem pedida pelo usuário antes de executar, lendo o código real: achou uma inconsistência de verdade, não uma lacuna — o plano dizia que o main resolveria hash→caminho, mas o worker já computava `attachmentsDir` sozinho, e `runQuery` estava assinado sem `hash`, sem como a *view* seria criada. O advisor acrescentou: `runQuery(hash, sql)` reabria a pergunta que a D18B.2 já fechara — concatenar `CREATE VIEW` e `SELECT` numa string só seria **o próprio app recriando o multi-statement que a guarda existe para barrar**. Corrigido para dois `connection.run()` separados. |
| 18/08/2026 | — | plano escrito | Achado central, antes de qualquer passo: `@duckdb/node-api` **não** exporta Arrow nativamente. Isso corrigiu uma premissa de `study/05` que vale para o cliente Python, não para este binding. A revisão do advisor tornou a guarda somente-leitura honesta: ela é sintática e best-effort, e **a fronteira real é o motor restrito do 18-A** — não a inspeção de texto. |

**O que este plano deixou fora dele:**

| Achado | Dono |
|---|---|
| Veredito Arrow-vs-JSON medido, e por que não se generaliza | skill [`data`](../../../.claude/skills/data/SKILL.md) |
| `read_csv_auto($1)` rejeita parâmetro vinculado — daí o caminho interpolado com hash validado | skill [`data`](../../../.claude/skills/data/SKILL.md) |
| `Vector.toArray()` troca `NULL` por `0` em silêncio | [`ARMADILHAS.md`](../../ARMADILHAS.md) |
| `createDuckdbRunQuery` enfileira para sempre depois que o worker morre | [`ARMADILHAS.md`](../../ARMADILHAS.md) |
| Decisões D18B.1–D18B.6 | [`DECISOES.md`](../../DECISOES.md) |

⚠️ **Achado registrado sem conserto, de propósito:** o handler do worker só é seguro porque `createDuckdbRunQuery` serializa — duas mensagens concorrentes intercalariam entre os `await`, com a *view* trocada e a leitura pegando linhas do outro dataset: **errado em silêncio, não um erro**. Comentado no próprio arquivo para que um segundo tipo de pedido não recrie o problema sem passar pela mesma serialização.

**Previsão que não se confirmou**, registrada para não ser carregada adiante: a revisão previu que `tableFromArrays` lançaria com resultado vazio ou coluna inteiramente `NULL`. Testado com os seis tipos do sniffer mais os dois casos — nenhum lança.