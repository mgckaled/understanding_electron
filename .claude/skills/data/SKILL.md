---
name: data
description: A camada de dados do crivo — motor DuckDB restrito em `utilityProcess`, a ordem exigida dos `SET` de segurança, `memory_limit`, a extensão `excel` vendorizada, e o veredito medido Arrow-vs-JSON (JSON venceu, o binding não exporta Arrow nativo). Use ao tocar `core/duckdb/`, `main/duckdb/`, `workers/duckdb/`, mexer no motor restrito, ou decidir entre Arrow e JSON num canal. Não cobre contrato IPC dos canais dataset:* (skill ipc) nem camadas (skill architecture).
---

# Camada de dados — crivo

> Contrato dos canais `dataset:*` (schema, `Result`, payload binário): skill [`ipc`](../ipc/SKILL.md). Camadas e regra de importação: skill [`architecture`](../architecture/SKILL.md). O caderno didático — *por que* `utilityProcess`, por que colunar vence linha-a-linha, o que é ABI/N-API — é [`study/05`](../../../docs/study/05-proximos-passos.md).

## O motor nunca roda no main

`src/workers/duckdb/index.ts` é o entrypoint do `utilityProcess` — segunda entrada em `rollupOptions.input` do bloco `main` do electron-vite (não existe um terceiro bloco além de main/preload/renderer, D18A.1). `src/main/duckdb/spawnWorker.ts` fala com ele: `createDuckdbWorkerClient` serializa toda chamada numa única fila (`tail` promise) — duas pré-visualizações disparando ao montar não trocam resposta entre si.

⚠️ **O mesmo mecanismo tem um risco aberto:** um worker morto no meio da fila deixa toda chamada seguinte sem resposta **nem erro**, com a UI girando para sempre. Registrado em [`ARMADILHAS.md`](../../../docs/ARMADILHAS.md).

`src/core/duckdb/` fica puro, sem `electron`, testável em Node puro contra uma `DuckDBInstance` real — nunca fake, mesmo princípio da skill [`testing`](../testing/SKILL.md) para o que persiste.

## O motor restrito, e a ordem que ele exige

`allowed_directories = [userData/attachments, userData/duckdb-tmp]` — o motor **nunca** enxerga o caminho original que o usuário escolheu, só a cópia que o anexo já fez, endereçada por hash. `enable_external_access = false` é definitivo, não uma trava que liga e desliga em runtime; `lock_configuration = true` fecha a sequência. A ordem real, de `buildDuckDbStartupCommands` (`core/duckdb/config.ts`):

```
LOAD <extensão>...  →  SET allowed_directories  →  SET temp_directory  →
SET enable_external_access = false  →  SET autoinstall/autoload = false  →
SET memory_limit  →  SET lock_configuration = true
```

⚠️ **`allowed_directories` e `temp_directory` têm que vir ANTES de `enable_external_access = false`** — DuckDB rejeita mudar qualquer um dos dois depois que o acesso externo já está desligado ("Cannot change allowed_directories when enable_external_access is disabled"). Só achado ao vivo (D18A.3) — a documentação do DuckDB é ambígua nisso, não confie na intuição de "configura tudo, trava por último".

**A ordem invertida deixa um blob copiado se o motor rejeitar o arquivo depois da cópia — e isso já está coberto.** `collectOrphanedAttachments` (`main/attachments/gc.ts`) varre, na inicialização, todo hash não referenciado por mensagem nenhuma; um anexo que falhou no meio cai exatamente nesse caso. Não escreva limpeza manual no caminho de erro do seu `attach*`: seria uma segunda política de retenção, divergindo em silêncio da que já roda.

Efeito prático em quem adiciona um formato de dataset novo: a ordem do anexo se **inverte** — hash → guarda em `attachmentsDir` → só então pergunta o schema ao motor, nunca o contrário — porque o motor não teria como ler o caminho original mesmo que tentasse.

## `memory_limit` é um retrato de agora, não um número a copiar

`DUCKDB_MEMORY_LIMIT = '2GB'` em `core/duckdb/config.ts` — remedido ao vivo no 18-A (5,54 GB livres de 15,81 GB, sem Ollama residente), não copiado do `ESCOPO.md`. DuckDB derrama para `temp_directory` acima do limite — errar para baixo é lento, não quebrado. **Não reaproveite este número sem remedir a RAM livre da máquina de novo** — mesmo princípio do `CLAUDE.md` § Máquina e modelos locais.

## Extensão `excel`: vendorizada, carregada por caminho local, travada por versão

`resources/duckdb-extensions/excel.duckdb_extension` (22.704.662 bytes), obtida uma vez por `scripts/fetch-duckdb-excel-extension.mjs` contra uma instância **sem** a config restrita, e vendorizada no repositório — nunca `INSTALL` em runtime, porque `enable_external_access = false` bloqueia rede. `LOAD` aceita caminho de arquivo `.duckdb_extension` local sem tocar `autoinstall_known_extensions` (D18A.3).

⚠️ **Travada à versão exata de `@duckdb/node-api` que a gerou.** Um `pnpm add @duckdb/node-api@<nova>` futuro não quebra `typecheck`/`lint` — nada que o compilador enxergue num arquivo binário —, só falharia em runtime. Rerodar o script faz parte do bump de versão ([`ROADMAP § 2`](../../../docs/ROADMAP.md)). A extensão core chega assinada: não foi preciso `allow_unsigned_extensions`.

## Arrow: montado em JS, e o veredito não foi o esperado

`@duckdb/node-api` **não exporta Arrow nativamente** — [issue duckdb-node-neo#45](https://github.com/duckdb/duckdb-node-neo/issues/45), sem prazo. O binding devolve dado JS colunar (`getColumnsObject()`/`getRows()`); `core/duckdb/arrow.ts` monta e serializa a `Table` via `apache-arrow` (`tableFromArrays`/`tableToIPC`) a partir desse dado.

**Medido no 18-B, não suposto: JSON venceu Arrow em tempo total nas duas escalas testadas** (~4× a 200 linhas, ~2,4× a 100 mil linhas) — a fronteira de processo custa pouco (≤20ms mesmo a 100 mil linhas), quem pesa é montar/desmontar a `Table` em JS, porque o motor não entrega Arrow pronto. A decisão do canal `dataset:query` continua Arrow mesmo assim — presa ao que o plano definiu antes de medir, não ao resultado da medição; gatilho de reabertura no `ROADMAP § 2`.

⚠️ **Isto é específico deste binding e desta forma de uso** — não generalize "Arrow é mais rápido" nem "JSON é mais rápido" para outro canal sem medir de novo.

## Duas armadilhas de leitura de resultado

⚠️ **`Vector.toArray()` troca `NULL` por `0` em silêncio** — lê o buffer tipado bruto sem consultar o *bitmap* de validade. Só iterar (`[...vector]`, ou `row.toArray()` de uma *row proxy* via `for (const row of table)`) consulta a validade de verdade.

⚠️ **`reader.getColumnsObject()` perde o schema inteiro quando o resultado tem zero linhas** — devolve `{}`, nenhuma coluna, e a tabela sai sem cabeçalho, indistinguível de "não fez nada". Use `columnNames()`, que carrega o schema independente da contagem de linhas.

⚠️ **`getColumnsObject()` não devolve valor JS plano para todo tipo.** DATE, TIMESTAMP e TIMESTAMPTZ voltam **embrulhados na classe própria do binding** (`DuckDBDateValue` — `{ days }`; `DuckDBTimestampValue`/`DuckDBTimestampTZValue` — `{ micros: bigint }`); todo o resto que os sniffers de CSV e JSON produzem já chega como `bigint`/`number`/`string`/`boolean`/`null`. Quem converte é `workers/duckdb/normalizeColumns.ts` — fica em `workers/`, não em `core/`, porque só essa camada já depende de `@duckdb/node-api` e conhece as formas dos wrappers (D18B).

**Ao adicionar um formato ou tipo de coluna novo, sonde o que ele devolve de fato.** Um tipo embrulhado que `normalizeValue` não trate passa intacto, chega ao `apache-arrow` como objeto opaco e fica **silenciosamente errado** — nenhum teste de string pega isso, só uma sonda contra o motor real. Foi assim que TIMESTAMP entrou (D18E.6): o 18-E escreveu `normalizeColumns` contra `DuckDBDateValue` apenas, e `read_json_auto` trouxe TIMESTAMP.

⚠️ **O tipo `JSON` é o fallback do próprio `read_json_auto` quando o tipo de um campo varia entre linhas** — não é um erro que o motor levante. Por isso `hasNestedType` (`core/duckdb/schema.ts`) recusa `^JSON$` junto de `STRUCT(`/`MAP(`/`[]`: um objeto de verdade escondido atrás desse fallback chega **serializado como string**, não como `DuckDBStructValue`, e passaria por coluna escalar comum.

A formatação de célula (`∅` para `null`/`undefined`, `.toString()` para `bigint`) tem **um** dono desde o plano 19: `features/attachment/formatCell.ts`. A régua dos três disparou ali — `DatasetQueryPanel.tsx` e `DatasetPreview.tsx` carregavam cópia própria até o terceiro consumidor (`StepProposalCard`, D19.6) chegar. **Importe, não copie**; e é um `.ts` avulso, não dobrado no `DatasetTable.tsx`, porque `react-refresh/only-export-components` recusa um `.tsx` exportando algo além de componente.

## Formatos suportados hoje

`csv`/`tsv`/`txt` (delimitado, `sniffDatasetFormat` + `scanDelimited`), `json`/`ndjson`/`jsonl` (`read_json_auto`), `xlsx` (`read_xlsx`).

⚠️ **Parquet não** — apesar de citado no `ESCOPO.md`/README como formato do produto, `src/main/features/dataset/pick.ts` não lista `.parquet` nas extensões do seletor; ninguém escreveu um 18-G ainda.

`sniffDatasetFormat` lê bytes crus antes de decodificar texto (assinatura ZIP `50 4B 03 04` identifica `.xlsx`, que é um ZIP por dentro) — evita decodificar um binário inteiro como UTF-8 inválido.

**Fallback de encoding:** `ensureDatasetView` tenta utf-8 primeiro; só se falhar com o erro específico de encoding, tenta `latin-1` (cache por hash no worker, nunca reclassifica o mesmo arquivo duas vezes). `latin-1` **não** é fallback infalível — byte `0x93`/`0x94` quebra os dois; quando ambos falham, sobe o erro **original** de utf-8, que nomeia o problema real.

## Onde a lógica mora, e como se testa

`core/duckdb/` é puro — nível 1, contra uma `DuckDBInstance` real, nunca fake. `main/duckdb/spawnWorker.ts` e `workers/duckdb/` não têm meta de cobertura (`main/` não tem meta — skill `testing`), mas os specs de `workers/duckdb/*.test.ts` já rodam contra o motor real também, não contra mock dele.
