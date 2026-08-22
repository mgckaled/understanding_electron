---
name: data
description: A camada de dados do crivo — motor DuckDB restrito em `utilityProcess`, a ordem exigida dos `SET` de segurança, `memory_limit`, a extensão `excel` vendorizada, e o veredito medido Arrow-vs-JSON (JSON venceu, o binding não exporta Arrow nativo). Use ao tocar `core/duckdb/`, `main/duckdb/`, `workers/duckdb/`, mexer no motor restrito, ou decidir entre Arrow e JSON num canal.
---

# Camada de dados — crivo

> Nasceu no plano 18 (sub-planos 18-A a 18-F, ago/2026), separada de [`docs/study/05-proximos-passos.md`](../../../docs/study/05-proximos-passos.md) em R-3: aquele documento continua caderno didático (por que `utilityProcess`, por que colunar vence linha-a-linha, o que é ABI/N-API) — o que se consulta **enquanto se edita código** tem dono aqui agora. Contrato dos canais `dataset:*` (schema, `Result`, payload binário): dono é a skill [`ipc`](../ipc/SKILL.md). Camadas e regra de importação: dono é a skill [`architecture`](../architecture/SKILL.md).

## O motor nunca roda no main

`src/workers/duckdb/index.ts` é o entrypoint do `utilityProcess` — segunda entrada em `rollupOptions.input` do bloco `main` do electron-vite (não existe um terceiro bloco além de main/preload/renderer, D18A.1). `src/main/duckdb/spawnWorker.ts` fala com ele: `createDuckdbWorkerClient` serializa toda chamada numa única fila (`tail` promise) — duas pré-visualizações disparando ao montar não trocam resposta entre si, mas o mesmo mecanismo significa que **um worker morto no meio da fila deixa toda chamada seguinte sem resposta nem erro**, UI girando para sempre (risco aberto, não deste plano — registrado no `HISTORY.md`). `src/core/duckdb/` fica puro, sem `electron`, testável em Node puro contra uma `DuckDBInstance` real — nunca fake, mesmo princípio da skill [`testing`](../testing/SKILL.md) para o que persiste.

## O motor restrito, e a ordem que ele exige

`allowed_directories = [userData/attachments, userData/duckdb-tmp]` — o motor **nunca** enxerga o caminho original que o usuário escolheu, só a cópia que o anexo (plano 16) já fez, endereçada por hash. `enable_external_access = false` é definitivo, não uma trava que liga e desliga em runtime; `lock_configuration = true` fecha a sequência. A ordem real, de `buildDuckDbStartupCommands` (`core/duckdb/config.ts`):

```
LOAD <extensão>...  →  SET allowed_directories  →  SET temp_directory  →
SET enable_external_access = false  →  SET autoinstall/autoload = false  →
SET memory_limit  →  SET lock_configuration = true
```

⚠️ **`allowed_directories` e `temp_directory` têm que vir ANTES de `enable_external_access = false`** — DuckDB rejeita mudar qualquer um dos dois depois que o acesso externo já está desligado ("Cannot change allowed_directories when enable_external_access is disabled"). Duas correções de ordem só achadas ao vivo (D18A.3) — a documentação do DuckDB é ambígua nisso, não confie na intuição de "configura tudo, trava por último" sem essa exceção.

Efeito prático em quem adiciona um formato de dataset novo: a ordem do anexo se **inverte** — hash → guarda em `attachmentsDir` → só então pergunta o schema ao motor, nunca o contrário — porque o motor não teria como ler o caminho original mesmo que tentasse.

## `memory_limit` é um retrato de agora, não um número a copiar

`DUCKDB_MEMORY_LIMIT = '2GB'` em `core/duckdb/config.ts` — remedido ao vivo no 18-A (5,54 GB livres de 15,81 GB, sem Ollama residente), não copiado do `ESCOPO.md`. DuckDB derrama para `temp_directory` acima do limite — errar para baixo é lento, não quebrado, mesma régua do `ESCOPO.md`. **Não reaproveite este número sem remedir a RAM livre da máquina de novo** — mesmo princípio do `CLAUDE.md` § Máquina e modelos locais.

## Extensão `excel`: vendorizada, carregada por caminho local, travada por versão

`resources/duckdb-extensions/excel.duckdb_extension` (22.704.662 bytes), obtida uma vez por `scripts/fetch-duckdb-excel-extension.mjs` contra uma instância **sem** a config restrita, e vendorizada no repositório — nunca `INSTALL` em runtime, porque `enable_external_access = false` bloqueia rede. `LOAD` aceita caminho de arquivo `.duckdb_extension` local sem tocar `autoinstall_known_extensions` (D18A.3). **Travada à versão exata de `@duckdb/node-api` que a gerou** — um `pnpm add @duckdb/node-api@<nova versão>` futuro não quebra `typecheck`/`lint` (nada que o compilador enxergue num arquivo binário), só falharia em runtime; rerodar o script faz parte do bump de versão (`ROADMAP § 2`). A extensão core chega assinada — não foi preciso `allow_unsigned_extensions`, confirmado ao vivo antes de qualquer código de produto.

## Arrow: montado em JS, e o veredito não foi o esperado

`@duckdb/node-api` **não exporta Arrow nativamente** — [issue duckdb-node-neo#45](https://github.com/duckdb/duckdb-node-neo/issues/45), sem prazo. Confirmado com Context7 nesta mesma sessão: o binding real devolve dado JS colunar (`getColumnsObject()`/`getRows()`), nenhum método de exportação Arrow existe na API pública. `core/duckdb/arrow.ts` monta e serializa a `Table` via `apache-arrow` (`tableFromArrays`/`tableToIPC`) a partir desse dado.

**Medido no 18-B, não suposto: JSON venceu Arrow em tempo total nas duas escalas testadas** (~4× a 200 linhas, ~2,4× a 100 mil linhas) — a fronteira de processo custa pouco (≤20ms mesmo a 100 mil linhas), quem pesa é montar/desmontar a `Table` em JS, porque o motor não entrega Arrow pronto. A decisão do canal `dataset:query` continua Arrow mesmo assim — presa ao que o plano definiu antes de medir, não ao resultado da medição; gatilho de reabertura registrado no `ROADMAP § 2`. **Isto é específico deste binding e desta forma de uso** — não generalize "Arrow é mais rápido" nem "JSON é mais rápido" para outro canal sem medir de novo.

## A armadilha de `NULL` em `Vector.toArray()`

`Vector.toArray()` lê o buffer tipado bruto sem consultar o *bitmap* de validade — troca `NULL` por `0` em silêncio. Só iterar (`[...vector]`, ou `row.toArray()` de uma *row proxy* via `for (const row of table)`) consulta a validade de verdade. `formatCell()` já resolve isso certo (`∅` para `null`/`undefined`, `.toString()` para `bigint`) — existe hoje em **dois** lugares, `DatasetQueryPanel.tsx` (original) e `DatasetPreview.tsx` (cópia deliberada, comentário próprio cita a régua dos três: copiar a segunda ocorrência, extrair só na terceira). Copie a mesma forma se surgir um terceiro consumidor; não invente um marcador novo, e lembre que a terceira cópia é o gatilho para extrair, não a segunda.

## Formatos suportados hoje

`csv`/`tsv`/`txt` (delimitado, `sniffDatasetFormat` + `scanDelimited`), `json`/`ndjson`/`jsonl` (`read_json_auto`), `xlsx` (`read_xlsx`). **Parquet não** — apesar de citado no `ESCOPO.md`/README como formato do produto, `src/main/features/dataset/pick.ts` não lista `.parquet` nas extensões do seletor de arquivo; ninguém escreveu um 18-G ainda. `sniffDatasetFormat` lê bytes crus antes de decodificar texto (assinatura ZIP `50 4B 03 04` identifica `.xlsx`, que é um ZIP por dentro) — evita decodificar um binário inteiro como UTF-8 inválido.

**Fallback de encoding:** `ensureDatasetView` tenta utf-8 primeiro; só se falhar com o erro específico de encoding, tenta `latin-1` (cache por hash no worker, nunca reclassifica o mesmo arquivo duas vezes). `latin-1` **não** é fallback infalível — byte `0x93`/`0x94` quebra os dois; quando ambos falham, sobe o erro **original** de utf-8 (nomeia o problema real, o do retry não).

## Onde a lógica mora, e como se testa

`core/duckdb/` é puro — nível 1, contra uma `DuckDBInstance` real, nunca fake. `main/duckdb/spawnWorker.ts` e `workers/duckdb/` não têm meta de cobertura (`main/` não tem meta — skill `testing`), mas os specs de nível superior (`workers/duckdb/*.test.ts`) já rodam contra o motor real também, não contra mock dele.
