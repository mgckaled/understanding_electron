# Fixtures — respostas reais da API do Context7

Gravadas **verbatim**, byte a byte, na sonda do corte [23-A](../../../../docs/plan/active/23-A-cliente-context7.md) em **07/09/2026**, contra `https://context7.com/api/v2`, sem chave (cota anônima). Nenhum campo foi aparado: o que estes arquivos existem para provar são justamente os campos que uma transcrição perderia — `id` repetido, `codeId` compartilhado entre trechos, `stars: -1`, `searchFilterApplied`, `generationDate` (ausente do `openapi.json`).

**A suíte nunca chama a API** — a cota é de 200 requisições por mês e uma corrida de testes a queimaria em dias (D23A.9).

| Arquivo | Chamada | O que prova |
|---|---|---|
| `search-tanstack-query.json` | `/libs/search?query=tanstack query` | 5 resultados, `/tanstack/query` **duas vezes** com `benchmarkScore` e `totalSnippets` diferentes; `stars: -1` nos `/websites/*`; `versions[]` misturando `v5.90.3`, `v5_84_1` e `v4_29_19` |
| `search-unpdf.json` | `/libs/search?query=unpdf` | 3 resultados — o teto de 5 é "até 5", não página fixa |
| `search-no-libraries-404.json` | `/libs/search?query=xqzvwrt` | `404 no_libraries_found`, corpo `{ error, message }` — não é lista vazia |
| `context-tanstack-query.json` | `/context?libraryId=/tanstack/query&type=json&fast=false` | resposta reranqueada: 3 trechos de código, 1 nota, 383 tokens; `codeId` como URL completa |
| `context-tanstack-query-fast.json` | idem, `fast=true` | **25 trechos, 3.497 tokens** — `fast` muda o tamanho, não só a ordem; 17 `codeId` únicos em 25 |
| `context-zod-shared-codeid.json` | `/context?libraryId=/colinhacks/zod&type=json&fast=false` | **1 `codeId` único em 5 trechos** — `codeId` endereça a página de origem, nunca o trecho; `infoSnippets` vazio; `codeLanguage: "APIDOC"` |

`rules` está **ausente em 11 de 11** respostas sondadas (6 em 06/09, 5 em 07/09). Não há fixture com ele; o caminho é exercitado por um objeto montado à mão no teste, e isso está declarado lá.
