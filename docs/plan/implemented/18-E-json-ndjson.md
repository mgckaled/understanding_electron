# 18-E — Anexo de JSON e NDJSON

**Depende de:** [18-A — Motor: instalação, endurecimento e a primeira travessia de processo](../implemented/18-A-motor-e-worker.md) (implementado) · [18-B — Canal, Arrow e a primeira consulta visível](../implemented/18-B-canal-e-consulta.md) (implementado) · [18-C — Pré-visualização automática](../implemented/18-C-pre-visualizacao.md) (implementado) · [18-D — Perfil nível 2 e o cartão aninhado](../implemented/18-D-perfil-e-cartao-aninhado.md) (implementado) · **Entrega:** anexar um `.json`/`.ndjson`/`.jsonl` **plano** (sem objeto aninhado) pelo mesmo caminho que hoje só aceita CSV/TSV/TXT — mesmo `DatasetCard`, mesma pré-visualização, mesma consulta, mesmo perfil, sem tocar nenhum dos três.

> Quinto dos sub-planos do 18. Os quatro anteriores construíram o motor, o canal, a pré-visualização e o perfil em cima de um único formato de entrada. Este plano testa se esse desenho generaliza — e a resposta, adiantada aqui porque decide a forma do plano inteiro: **generaliza quase de graça**, porque `dataset:query`/`dataset:profile` nunca souberam que liam CSV — só sabem que existe uma *view* chamada `dataset`. O trabalho real está todo em decidir **quem** monta essa *view* a partir de um JSON, e **quando** o app descobre que é JSON.

**Fora deste plano:** Parquet (fica para quando houver demanda real de exportação — `ESCOPO.md` já lista os quatro formatos, mas este arco só abriu CSV e JSON) · Excel (18-F) · JSON **aninhado** (objeto ou lista dentro de uma célula) — `ESCOPO.md` já registra que isso "exige achatamento"; este plano recusa com erro claro, não tenta achatar · unificar `core/dataset/scan.ts` com o leitor do DuckDB para CSV — gatilho que o 18-C já tinha adiado (D18C.7) e que este plano **não** reabre, mesmo cogitando DuckDB para o esquema de outro formato (ver D18E.5).

---

## O que a leitura dos planos implementados mudou neste desenho

Cinco fatos do código real — `core/duckdb/{config,query,profile,protocol}.ts`, `workers/duckdb/index.ts`, `main/duckdb/spawnWorker.ts`, `main/features/dataset/handlers.ts`, `main/attachments/{storage,gc}.ts`, `core/dataset/{scan,hashedLines}.ts`, `renderer/.../{DatasetCard,DatasetPreview,DatasetQueryPanel,DatasetProfile,AttachButton}.tsx` — lidos antes de qualquer decisão abaixo:

1. **`ensureDatasetView` (18-B, corrigida pós-18-C) já resolve "criar a *view* certa para este hash" com um cache por hash** (`encodingByHash: Map<string, 'latin-1'>`, dentro do worker) — o precedente exato que este plano generaliza para formato, não um mecanismo novo.
2. **O motor está travado a `allowed_directories = [attachmentsDir, tempDir]` desde o 18-A** (`enable_external_access = false`, `lock_configuration = true`) — o worker **não pode** ler o arquivo original que o usuário escolheu, só a cópia já dentro de `attachmentsDir`. Isso decide a ordem do anexo de JSON (D18E.3): o motor só entra em cena **depois** de `storeAttachment` copiar o arquivo.
3. **`dataset:query`/`dataset:profile` recebem só `{ hash, sql }`/`{ hash }`** — nenhum dos dois carrega informação de formato, e os quatro consumidores do lado renderer (`DatasetPreview`, `DatasetQueryPanel`, `DatasetProfile`, `AttachButton`) só conhecem `hash`/`part`. Estender os três canais e as quatro chamadas para carregar `format` repetiria o erro que o advisor corrigiu no 18-C (adicionar um parâmetro a um canal fechado, quando o problema tinha solução mais barata) — D18E.1 evita isso.
4. **`createDuckdbWorkerClient` serializa `runQuery`/`runProfile` numa fila única (D18D.1)** — qualquer requisição nova ao worker (este plano acrescenta uma terceira, D18E.3) tem que passar pela mesma fila, não abrir uma própria.
5. **`collectOrphanedAttachments` (D16.2) já varre todo hash não referenciado por nenhuma mensagem**, na inicialização e após remover uma conversa — cobre, sem mudança nenhuma, o caso de um anexo de JSON que falha a validação **depois** de já ter sido copiado para `attachmentsDir` (D18E.3, abaixo).

---

## Decisões

### D18E.1 — Formato é detectado pelo **conteúdo**, uma função só, nunca por um parâmetro novo no canal

`core/dataset/format.ts` ganha `sniffDatasetFormat(sample: string): 'delimited' | 'json'` — olha o primeiro caractere não-espaço da amostra: `{` ou `[` é JSON, qualquer outra coisa é delimitado. **Corrigido antes de qualquer código, achado do advisor**: um JSON com BOM começa com o byte U+FEFF, que `String.prototype.trimStart()` **não remove** (removido da propriedade `White_Space` do Unicode desde a versão 6.3, então `trimStart` nunca o tratou como espaço) — sem descartar esse caractere primeiro, todo JSON com BOM cairia silenciosamente no leitor de CSV. `sniffDatasetFormat` descarta um U+FEFF inicial antes de olhar o próximo caractere; teste de nível 1 cobre isso como fixture própria, não como aposta.

**Por que conteúdo, e não os dois caminhos mais óbvios:**
- **Não por extensão do arquivo** — o hash já é a identidade de armazenamento (D16.3, conteúdo-endereçado, sem extensão em `attachmentsDir/<hash>`); usar a extensão do caminho original exigiria guardá-la em algum lugar novo, e um arquivo `.txt` que na verdade é NDJSON (comum: exportação de log) seria tratado errado sem necessidade.
- **Não por um campo `format` novo em `dataset:query`/`dataset:profile`** — os dois canais já foram fechados e testados nos planos 18-B/18-D; estender a assinatura dos dois, mais o handler, mais `preload`, mais `test/api-mock.ts`, mais as quatro chamadas do lado renderer, para resolver um problema que uma função pura de ~5 linhas resolve sozinha, é exatamente o desvio que o advisor cortou no 18-C (lá era um `limit`, aqui seria um `format` — mesma classe de erro, evitada desta vez **antes** de escrever a primeira linha, não depois de um round-trip com o advisor).

**A mesma função roda nos dois lados, sobre os mesmos bytes** — no *main*, sobre o arquivo original, ao decidir qual caminho `attachDataset` segue (D18E.3); no *worker*, sobre a cópia em `attachmentsDir/<hash>`, ao decidir se `ensureView` monta `read_csv_auto` ou `read_json_auto` (D18E.5). Como os bytes são idênticos por construção (é a mesma cópia content-addressed), os dois lados **não podem discordar** — não por disciplina de manter duas heurísticas em sincronia, mas porque é literalmente a mesma função sobre o mesmo conteúdo. Elimina por construção o tipo de divergência que a D18C.7 testou entre `scanDelimited` e `read_csv_auto` (duas implementações podendo discordar de um mesmo arquivo).

O worker cacheia o resultado por hash, mesma forma de `encodingByHash`: `formatByHash: Map<string, 'json'>` (ausente = delimitado, o default de hoje).

### D18E.2 — `DatasetPart` ganha `format`; `delimiter` vira opcional — montados em `attachDataset`, `DatasetSummary`/`scanDelimited` ficam como estão

**Correção sobre um primeiro rascunho desta decisão, achada pelo advisor**: transformar `DatasetSummary` numa união discriminada por `format` obrigaria `scanDelimited` a passar a emitir `format: 'delimited'` — um retorno que hoje é só `{ delimiter, columns, rowCount }` — contradizendo a própria D18E.5 ("`scan.ts` fica intocado"). `DatasetSummary` **não muda**:

```ts
export type DatasetSummary = {
  delimiter: string
  columns: string[]
  rowCount: number
}
```

`format` é acrescentado **em `attachDataset`**, ao montar o `DatasetPart` final — não em `scanDelimited`, que continua devolvendo exatamente o mesmo formato de hoje, chamada exatamente como hoje:

```ts
export const datasetPartSchema = z.object({
  kind: z.literal('dataset'),
  hash: z.string().min(1),
  fileName: z.string().min(1),
  format: z.enum(['delimited', 'json']),
  delimiter: z.string().optional(),
  columns: z.array(z.string()),
  rowCount: z.number().int().nonnegative()
})
```

O caminho delimitado de `attachDataset` (D18E.3) monta `{ ..., format: 'delimited', delimiter: scanned.value.delimiter, ... }`; o caminho JSON monta `{ ..., format: 'json', ... }`, sem `delimiter`. `core/ai/dataCard.ts` — o que o modelo lê — **não muda**: já não cita `delimiter`, só `fileName`/`columns`/`rowCount` (conferido no código real antes desta decisão, não presumido). O único consumidor de produção de `delimiter` é a linha "Separador" do modal de confirmação em `AttachButton.tsx` — vira condicional ao `format` (D18E.6).

### D18E.3 — Esquema de JSON vem do motor, não de um parser manual novo; e a ordem do anexo se inverte

Não existe hoje um scanner manual de JSON equivalente a `scanDelimited` — e escrever um duplicaria a inferência de esquema que o `read_json_auto` do DuckDB já faz. A fonte do esquema (`columns`/`rowCount`) para um anexo JSON é o motor, via uma **terceira** requisição do protocolo do worker: `{ kind: 'schema'; hash: string }` → `{ kind: 'schema'; ok: true; columns: string[]; rowCount: number } | { kind: 'schema'; ok: false; message: string }` (`WorkerRequest`/`WorkerResponse` em `core/duckdb/protocol.ts`, `createDuckdbWorkerClient` ganha `runSchema`, sobre a **mesma** fila de serialização das outras duas — D18D.1 generaliza, não abre exceção).

**Isso exige inverter a ordem que `attachDataset` usa para CSV.** Hoje: escaneia o arquivo original → só então copia para `attachmentsDir`. Para JSON isso não funciona — o motor só enxerga `attachmentsDir`/`tempDir` (D18A.3, `enable_external_access = false`), nunca o caminho original que o diálogo devolveu. A ordem para JSON: hash (drena `createHashedLines` para o `digest()`, sem rodar `scanDelimited`) → `storeAttachment` copia para `attachmentsDir/<hash>` → **então** `runSchema(hash)` pergunta ao motor. O caminho de CSV continua exatamente como está — só o de JSON é nova ordem, decidida por uma restrição que já existe desde o 18-A, não inventada aqui.

**Se `runSchema` rejeitar** (JSON aninhado — D18E.4 — ou JSON malformado que passou pela sondagem de conteúdo da D18E.1 mas não é válido de verdade), o arquivo **já foi copiado** para `attachmentsDir`. Não é vazamento: `collectOrphanedAttachments` (D16.2) varre todo hash não referenciado por nenhuma mensagem, na inicialização e após remover conversa — e um anexo que `attachDataset` recusou nunca chega a ser parte de mensagem nenhuma, então cai exatamente no caso que o D16.2 já existe para fechar ("anexo que teve sucesso e foi descartado antes de ser enviado"). Confirmado lendo `gc.ts` real antes de assumir isso, não por analogia.

### D18E.4 — JSON aninhado é recusado explicitamente — o motor não erra sozinho, o app precisa

Confirmado via Context7 (`duckdb-web`): `read_json_auto` **não falha** diante de um objeto ou lista aninhada — infere um tipo `STRUCT`/`MAP`/`LIST` e seguiria em frente. Sem uma recusa explícita, um JSON aninhado passaria a `DatasetPart` com uma coluna cujo valor é um objeto — e nada a jusante (`formatCell` no `DatasetQueryPanel`/`DatasetPreview`/`DatasetProfile`) sabe renderizar isso: uma lista de valores viraria texto concatenado por vírgula, plausível o bastante para não ser óbvio que está errado — exatamente o "modo de falha mais caro" que o `ESCOPO.md` nomeia (parece resposta, não é). `core/duckdb/schema.ts` ganha `hasNestedType(columnType: string): boolean`, checando `STRUCT`/`MAP` ou sufixo `[]` (`LIST`) no tipo que `DESCRIBE` devolve — puro, testado em nível 1 com os nomes de tipo reais que o DuckDB produz, não inventados. `handleSchema` no worker roda `DESCRIBE SELECT * FROM "dataset"` (mesma função `sqlIdentifier`/mesmo padrão de `buildSummarizeSql`, D18D.2) depois de `ensureView`; se qualquer coluna qualificar, devolve `ok: false` com mensagem nomeando a coluna — nunca aceita silenciosamente.

**Isto não é limitação do motor — é decisão do produto, e vale marcar por quê.** `STRUCT`/`MAP`/`LIST` são tipos de primeira classe no DuckDB, com sintaxe própria para navegar dentro deles; o motor aceitaria de bom grado. A recusa existe porque nada a jusante (`formatCell` em `DatasetQueryPanel`/`DatasetPreview`/`DatasetProfile`) sabe renderizar uma célula com um objeto ou lista dentro — silenciosamente errado, não obviamente quebrado, o modo de falha que o `ESCOPO.md` já nomeia como o mais caro. Achatar de verdade (decidir que caminho aninhado vira coluna de topo, o que fazer quando uma lista tem tamanhos diferentes por linha) é decisão de produto própria, não uma bandeira a virar — fica para quando houver demanda real, possivelmente como passo do pipeline de tratamento que o `ESCOPO.md` já prevê, não como parte deste plano.

**Vale registrar, para quem ler isto depois, que "JSON aninhado" aqui é o caso raro, não o comum** — discutido com o usuário ao revisar esta decisão: JSON **como dado tabular** (o que este plano atende) tende a vir plano por natureza — é exportação de registro, não estrutura de programa. JSON **como código/config** (`package.json`, `tsconfig.json`, *fixture* de API, log estruturado) é o oposto: costuma vir aninhado, com frequência em vários níveis em sequência — e é exatamente o caso comum nesse outro contexto. Esta decisão não tenta cobrir os dois: o caminho de código/config é do pilar Código (`ESCOPO.md` § Documento, ainda sem plano numerado — `ROADMAP § 2`), que nunca interpreta estrutura, só entrega texto cru ao modelo — lá, aninhado não é problema nenhum, porque não existe motor relacional para exigir forma de tabela. Os dois caminhos não competem pelo mesmo arquivo: a escolha é o botão de anexo que o usuário aperta (dataset vs. documento), não uma sondagem de conteúdo — D18E.4 só entra em cena depois de o usuário já ter escolhido "anexar dataset".

### D18E.5 — `kind: 'schema'` reaproveita `ensureView`; `scanDelimited` fica intocado

`handleSchema` chama a **mesma** `ensureView(hash)` que `handleQuery`/`handleProfile` já chamam — populando `formatByHash` (D18E.1) na primeira vez que um hash JSON é visto, o que também beneficia a primeira consulta/perfil reais sobre o mesmo hash, de graça. Depois: `DESCRIBE` (D18E.4) → `COUNT(*)` (reaproveita `buildCountSql`, já genérico sobre nome de tabela desde o 18-D, D18D.2 — nenhuma função nova para isso).

**O que este plano não faz, por decisão, não por esquecimento:** `core/dataset/scan.ts` (o parser manual de CSV) não muda. Seria tentador, tendo acabado de ensinar o app a pedir esquema ao DuckDB, usar o mesmo caminho para CSV também — mas essa unificação já é uma tentação nomeada e adiada desde o 18-C (D18C.7, "trocar o scanner do nível 1 por DuckDB é uma unificação fora do escopo"). Fazer isso aqui, de carona num plano que devia só somar um formato, misturaria duas mudanças numa sessão — contra o "uma variável por vez" que o `CLAUDE.md` já fixa como princípio de trabalho deste projeto.

### D18E.6 — Interface: filtro do diálogo, linha condicional, e o resto do arco só precisa de prova ao vivo

`pickDataset` (`main/features/dataset/handlers.ts`) ganha um segundo `filters` no diálogo nativo — `{ name: 'JSON', extensions: ['json', 'ndjson', 'jsonl'] }`, ao lado do já existente `Delimited text` — o próprio SO desenha o seletor de tipo, sem UI nova. `AttachButton.tsx`: a linha "Separador" do modal de confirmação renderiza só quando `part.format === 'delimited'` (D18E.2); para JSON, uma linha "Formato: JSON" ocupa o lugar, mesma forma de lista.

**`DatasetCard`, `DatasetPreview`, `DatasetQueryPanel`, `DatasetProfile` não mudam uma linha de código** — nenhum dos quatro sabe ou precisa saber que existe mais de um formato; todos falam só de `hash` e da *view* `dataset`. Esse é o resultado que D18E.1 comprou. **Mas "não mudou código" não é "está provado" — é a única coisa que o passo 5 existe para verificar ao vivo**, não para presumir: uma *view* sobre `read_json_auto` produz tipos que uma *view* sobre `read_csv_auto` pode nunca ter exercitado no caminho de conversão — `read_json_auto` infere `TIMESTAMP` de uma string ISO, e `normalizeColumns.ts` (que o 18-B acrescentou especificamente para o `DuckDBDateValue` que o `read_csv_auto` produz) nunca viu esse tipo vindo de outro lugar. O passo 5 exercita isso de propósito, não como formalidade.

---

## Passos

| # | Entrega | Testes | Aceite |
|---|---|---|---|
| **1** | `core/dataset/format.ts` — `sniffDatasetFormat` (D18E.1), com o descarte de BOM | Nível 1: `{...}` → `json`; `[...]` → `json`; CSV comum → `delimited`; **BOM (`﻿{...}`) → `json`**, fixture própria; string vazia/só espaço → `delimited` (default seguro) | Testes verdes; nenhuma dependência de DuckDB ou Electron |
| **2** | `core/duckdb/query.ts` generalizado — `buildViewSqlInterpolated`/`ensureDatasetView` ganham `format` (dispatch `read_csv_auto`/`read_json_auto`; retry de encoding só quando `format === 'delimited'`); novo `core/duckdb/schema.ts` — `buildDescribeSql`, `hasNestedType` (D18E.4), reaproveita `buildCountSql` de `profile.ts` | Nível 1: `hasNestedType` com os nomes reais que o `DESCRIBE` do DuckDB produz (`STRUCT(a INTEGER)`, `MAP(VARCHAR, INTEGER)`, `INTEGER[]`, e o caso negativo `VARCHAR`/`BIGINT`); `buildViewSqlInterpolated` com `format: 'json'` monta `read_json_auto`, sem cláusula de encoding | Testes verdes; nenhuma dependência de DuckDB ou Electron — mesma régua do 18-B passo 1 |
| **3** | Worker: `kind: 'schema'` (D18E.3) — `core/duckdb/protocol.ts`, `main/duckdb/spawnWorker.ts` (`runSchema`, mesma fila `createEnqueue`), `workers/duckdb/index.ts` (`ensureView` consulta `formatByHash`, sondando com `sniffDatasetFormat` na primeira vez; `handleSchema` roda `DESCRIBE` + `hasNestedType` + `COUNT(*)`) | Nenhum nível 1–3 (mesma classe do 18-A/18-B/18-D: `utilityProcess` é API do Electron) | `pnpm dev` ao vivo: pedido `schema` contra um NDJSON real devolve `columns`/`rowCount` plausíveis; contra um JSON com objeto aninhado devolve erro nomeando a coluna; um pedido de `query`/`profile` **depois** do `schema`, mesmo hash, não sonda o formato de novo (`formatByHash` populado) |
| **4** | `attachDataset` reestruturado (D18E.3) — recebe `runSchema` injetado (mesmo padrão de `runQuery`/`runProfile`, D18B.6/D18D); ramifica por `sniffDatasetFormat` no arquivo original; caminho delimitado **inalterado, `scanDelimited` chamada exatamente como hoje**, só monta `format: 'delimited'` a mais no `DatasetPart` final (D18E.2); caminho JSON: drena o hash → guarda → `runSchema` → `hasNestedType` rejeitado vira `AppError`; `pickDataset` ganha o filtro JSON (D18E.6); `datasetPartSchema` ganha `format`/`delimiter` opcional (D18E.2) | Nível 3: `attachDataset` com `runSchema` dublê — JSON válido produz `DatasetPart` `format: 'json'`; JSON aninhado (`runSchema` dublê rejeitando) devolve `Result` de erro sem quebrar; CSV continua idêntico ao 18-B/16 (teste de não-regressão, dublê nunca chamado nesse caminho, `scanDelimited` real, não dublê) | Teste nível 3 verde; teste de CSV existente (planos 16/18-B) continua verde sem alteração — prova de que o caminho delimitado não regrediu |
| **5** | UI: linha condicional em `AttachButton.tsx` (D18E.6) | Nível 2: fixture `format: 'json'` não renderiza "Separador", renderiza "Formato: JSON" | `pnpm dev` ao vivo, **o item real deste passo**: anexar um NDJSON com colunas cobrindo os seis tipos que `arrow.test.ts` já testa (`BIGINT`, `DOUBLE`, `VARCHAR`, `DATE`, `BOOLEAN`, coluna com `NULL`) **mais uma sétima coluna `TIMESTAMP` (string ISO com hora, não só data)** — a que `normalizeColumns.ts` nunca viu, porque foi escrita contra o que `read_csv_auto` produz, e `DATE` sozinha não a exercita; pré-visualização, Consultar e Perfil, cada um, mostrando as sete colunas corretas, sem célula quebrada nem exceção; um segundo anexo, JSON com objeto aninhado numa coluna, recusado com mensagem clara na hora de anexar, nunca chegando a virar `DatasetPart` |
| **6** | Fechamento: diário; `HISTORY.md` se o passo 5 revelar algo no caminho `TIMESTAMP`/`normalizeColumns.ts`; `ROADMAP § 2` — nenhum gatilho novo além do já existente para `scanDelimited`/DuckDB (D18C.7, D18E.5 só reafirma) | — | `pnpm check:fast` verde; nada pendente de registro |

---

## Ordem de dependência

```
1 (sniff puro) ──► 2 (SQL/schema puros) ──► 3 (worker: kind schema) ──► 4 (attachDataset) ──► 5 (UI + prova ao vivo) ──► 6 (fechamento)
```

Linear — cada passo depende do anterior existir de verdade; nenhum tem razão para rodar fora dessa ordem.

---

## Riscos

1. **`sniffDatasetFormat` decide com um caractere só** — um CSV cujo cabeçalho comece, sem aspas, por `{` ou `[` (extremamente incomum, mas não impossível) seria lido como JSON e falharia alto, não silenciosamente — `read_json_auto` rejeitaria o conteúdo com um erro de parse claro. Aceito: o caminho de falha é ruidoso, não um dado errado sem aviso, e o caso é raro o bastante para não justificar uma sondagem mais cara para todo arquivo.
2. **`read_json_auto` também amostra para inferir tipo, mesma classe de custo que o `read_csv_auto` já tem (D18C.7)** — não medido separadamente neste plano; o passo 5 confirma plausibilidade, não mede custo em escala. Se um dataset JSON real na escala do `ESCOPO.md` (~2GB) expuser um custo de anexo desproporcional, é achado para registrar, não bloqueante para fechar.
3. **NDJSON com linhas de esquema inconsistente (campo ausente em algumas linhas)** — o `read_json_auto` funde por amostragem; não testado neste plano com um fixture propositalmente inconsistente. Fica para quando um caso real aparecer, mesmo critério que o 18-D usou para o limiar de cardinalidade (juízo até haver dado real para calibrar).

---

## Verificação

- `pnpm check:fast` depois de cada passo.
- `pnpm dev` ao vivo nos passos 3 e 5 — a prova de vida do worker e o fluxo completo (incluindo os quatro componentes que este plano não deveria ter tocado), respectivamente.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 21/08/2026 | 1-6 | **plano concluído**, movido para `implemented/` | Seis passos, três commits. Prova ao vivo com Playwright `_electron` contra o app real, virou spec permanente (`e2e/dev/attach-json-dataset.spec.ts`). `check:fast` a frio: ~57s, 71 arquivos, 607 testes. Duas rodadas de `advisor` acharam 7 correções, todas aplicadas com teste antes de fechar. |
| 21/08/2026 | — | plano escrito e revisado, ainda não executado | Escrito lendo o **código** dos quatro sub-planos anteriores, não os planos. Context7 (`duckdb-web`) confirmou `read_json_auto` detectando `auto`/`unstructured`/`newline_delimited`/`array` num só parâmetro `format` — por isso `DatasetSummary` não distingue JSON de NDJSON. |

**O que este plano deixou fora dele** — escalonado na conclusão, e é onde se consulta hoje:

| Achado | Dono |
|---|---|
| BOM (U+FEFF) sobrevive a `trimStart()`; JSON com BOM lia como delimitado | [`ARMADILHAS.md`](../../ARMADILHAS.md) |
| `reader.getColumnsObject()` devolve `{}` com zero linhas — tabela sem cabeçalho | [`ARMADILHAS.md`](../../ARMADILHAS.md) |
| `getByText` solto num spec de `e2e/dev` colide com o `%APPDATA%` real | [`ARMADILHAS.md`](../../ARMADILHAS.md) |
| Segundo filtro de `showOpenDialog` fica invisível — o diálogo só mostra o primeiro | [`ARMADILHAS.md`](../../ARMADILHAS.md) |
| TIMESTAMP volta embrulhado em `DuckDBTimestampValue`; sonde tipo novo | skill [`data`](../../../.claude/skills/data/SKILL.md) |
| Tipo `JSON` é o fallback do `read_json_auto` quando o campo varia entre linhas | skill [`data`](../../../.claude/skills/data/SKILL.md) |
| Blob órfão de `attach` interrompido já é coberto por `collectOrphanedAttachments` | skill [`data`](../../../.claude/skills/data/SKILL.md) |
| Decisões D18E.1–D18E.6 | [`DECISOES.md`](../../DECISOES.md) |

⚠️ **Aceite não observado, registrado como tal:** o terceiro item do passo 3 — `formatByHash` não sondar de novo entre `schema` e `query`/`profile` — nunca foi medido. O e2e não distingue os dois casos (sondar de novo daria o mesmo `json` correto). Correto por construção, mas **não verificado**.
