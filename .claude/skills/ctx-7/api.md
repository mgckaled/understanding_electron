# Context7 — a API, medida

Consulta rara, deliberadamente fora do [`SKILL.md`](SKILL.md): nada aqui decide a primeira linha, mas quase tudo aqui **desmente uma suposição razoável**. Cada item foi sondado contra a API real no arco 23, não lido do schema publicado.

> ⚠️ **O `openapi.json` está atrás da API.** `generationDate` e `searchFilterApplied` voltaram em respostas reais sem estar nele. **Fixture vem da resposta, nunca do schema** — derivada do schema, ela testaria o schema.

## As duas rotas, e os quatro parâmetros

| Operação | Endpoint | Parâmetros |
|---|---|---|
| buscar biblioteca | `GET /api/v2/libs/search` | `query` (é o sondado; `libraryName` também responde) |
| buscar documentação | `GET /api/v2/context` | `libraryId`, `query`, `type`, `fast` |

- **Autenticação:** `Authorization: Bearer ctx7sk-…`. A rota é pública sem chave, mas o app **exige** chave (D23I.5). O prefixo `ctx7op-` é de conta *enterprise*.
- **`type` tem default `txt`** — o `json` é default do SDK, não da API. Quem chama por `fetch` e omite recebe texto.
- **Versão:** `libraryId` aceita `/owner/repo/v15.1.8` **ou** `/owner/repo@v15.1.8`. O app usa a primeira forma.
- **Não há paginação.** Sem `page`, sem `hasNext`, sem `total`; `limit` e `page` são **ignorados** se enviados. Fonte secundária que cite "até 10 páginas" descreve a v1, deprecada — que também tinha `tokens` e `topic`, ausentes na v2. **O controle de tamanho na v2 é seleção do lado do cliente.**

### `fast` é o parâmetro invertido, e o nome engana

`fast=true` pula o reranqueamento por LLM **do lado deles** e devolve o conjunto de candidatos inteiro. Medido, mesma pergunta ao `/tanstack/query`:

| | Trechos | Tokens |
|---|---|---|
| `fast=false` | 3 | 383 |
| `fast=true` | **25** | **3.497** |

**Pela mesma chamada de cota, e mais rápido** — é o reranqueamento que custa os segundos. O app chama isso de `broad` e traduz para `fast` só no cliente (D23J.3), porque propagar a inversão por três camadas convida a ler "rápido" onde se quis dizer "amplo".

⚠️ **O teto de "4 ou 5 trechos" é do reranqueador, não da API.** Quem escrever código presumindo resposta pequena quebra no caminho amplo.

## O que volta, e o que mente

### `/v2/libs/search`

```text
results[] → id · title · description · branch · lastUpdateDate · state
            totalTokens · totalSnippets · stars · trustScore
            benchmarkScore · versions[]
```

| Achado | Consequência em código |
|---|---|
| **`id` se repete dentro da mesma resposta** — `/tanstack/query` volta duas vezes, diferindo só em `benchmarkScore` e `totalSnippets` | `id` não serve de `key` do React nem de identidade de seleção; o app cunha uma chave sintética (D23A.5/D23E.4) |
| **A ordem não é estável entre chamadas idênticas** — quatro corridas, a quarta com as posições 1 e 2 trocadas | "o primeiro resultado" não é conceito estável; a ordenação é do app, e existe para dar **determinismo**, nunca relevância |
| **A ordem da API não segue `trustScore` nem `benchmarkScore`** | ordenar do lado do app é o que dá previsibilidade (D23A.4, quatro chaves — o desempate por `id` não basta, porque `id` se repete) |
| **`benchmarkScore` é atributo da biblioteca, não do casamento com a pergunta** — e muda com o tempo (89,01 → 87,66 em um dia) | teste que dependa do valor exato nasce frágil; asserte ordenamento |
| **`stars: -1` é sentinela**, não contagem — aparece em todo `/websites/*` | exibir cru mostraria "−1 estrelas" |
| **`versions[]` não é ordenável nem homogêneo** — `["v5.60.5", "v5.71.10", "v5_84_1", "v4_29_19", "v5.90.3"]`, e `/reactjs/react.dev` traz **só** `"__branch__v18"` | **"mais recente" não é calculável** (D23A.6); ordenar por semver quebra no `_`, e `__branch__*` se filtra antes de exibir. Lista vazia é o **caso comum** em `/websites/*` |
| **`branch` não é sempre `main`** — `master` apareceu em dois de cinco no `pandas` | o campo se exibe, não se presume |

⚠️ **Sem correspondência nem sempre é `404`.** `query=zzqqxx-biblioteca-inexistente-42` devolveu **`200` com cinco bibliotecas sem relação nenhuma** (Perl, Cloudflare R2, Godot), com `benchmarkScore` de até 78; só `query=xqzvwrt` produziu o `404 no_libraries_found`. **O modo de falha real da busca não é "nada encontrado", é "cinco resultados irrelevantes"** — e nenhum campo o sinaliza. A tela de desambiguação é a defesa.

⚠️ **E a ordenação do app erra feio, por desenho.** Em `pandas`, ela pôs `/rsheftel/pandas_market_calendars` em **primeiro** e o `/pandas-dev/pandas` em **terceiro**. Nenhum campo da resposta acerta sozinho — é o que torna a desambiguação pelo usuário necessária, não preferência.

### `/v2/context`

```text
codeSnippets[]  (obrigatório) → codeTitle · codeDescription · codeLanguage
                                codeTokens · codeId · pageTitle · codeList[]
infoSnippets[]  (obrigatório) → pageId · breadcrumb? · content · contentTokens
rules?          (opcional)    → global[] · libraryOwn[] · libraryTeam[]
```

| Achado | Consequência em código |
|---|---|
| **`codeId` endereça a PÁGINA, não o trecho** — 1 único em 5 trechos no zod, 17 em 25 na resposta ampla | serve de link de procedência e **nunca** de identidade |
| **`codeId` tem dois formatos reais** — URL completa **e** id relativo com âncora (`lazy-loading.mdx#_snippet_7`) | `new URL(codeId)` com a falha tratada como "sem link" é o único tratamento seguro (D23F.10) |
| **`codeList[]` são VARIANTES do mesmo exemplo** (TypeScript e JavaScript), às vezes idênticas | juntá-las renderiza o mesmo código duas vezes; o app guarda `blocks[]` e deduplica (D23B.11, D23F.11). **Não há parâmetro de idioma na requisição** |
| **`codeLanguage` não é normalizado** — `TypeScript`, `typescript`, `tsx`, `js` na mesma resposta, e o valor **`APIDOC`**, que não é linguagem | filtrar por linguagem exigiria normalizar caixa e decidir se `tsx` conta; ficou de fora |
| **`pageTitle` tem sentinela** — veio literalmente `"Unknown"` em todos os trechos de duas respostas | exibir cru mostraria "Unknown" como título |
| **`infoSnippets` TEM procedência** — `pageId` é URL completa | a aba Notas linka como a de Trechos |
| **`infoSnippets` vem vazia com frequência** — 3 de 4 respostas `fast=false` | a aba precisa de estado vazio próprio |
| **`sourceFile` veio ausente** em todos os trechos sondados | não construir nada sobre ele |
| **`rules` ausente em 11 de 11 sondas** — todas anônimas | duas das três listas só chegam com chave de *teamspace*; ver `SKILL.md` |

⚠️ **`empty` cobre só as DUAS listas vazias ao mesmo tempo** (`client.ts`): um `ready` com zero trechos e notas presentes é tela real.

⚠️ **`totalTokens` da busca é a biblioteca inteira, não a resposta.** 825k no Next.js contra as centenas de uma consulta — a fatia fica na ordem de 0,1%.

## Cota

- Headers documentados e lidos pelo cliente: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, e `Retry-After` no 429. O cliente os lê em minúsculas, e `Headers.get` é insensível a caixa.
- **As duas rotas consomem o mesmo contador** — sondado.
- **`Ratelimit-Reset` é epoch na virada do mês UTC.** Formatá-lo em data **local com hora** é deliberado (D23A.11): a virada cai no meio da noite anterior aqui, e nomear a data UTC mandaria esperar um dia a mais por uma cota que já voltou.
- **Anônimo e com-chave são contadores separados**, e o `Reset` é o mesmo nos dois. Detalhe e o porquê de não somá-los: [`SKILL.md`](SKILL.md).
- ⚠️ **Levantado, nunca sondado:** fonte secundária descreve o regime anônimo como *pool global compartilhado*. Procedência fraca — **não citar como fato**.

## Armadilha de sonda

⚠️ **O Git Bash converte `libraryId=/vercel/next.js` em caminho do Windows** (`/c:/program files`), e a API responde `404 library_not_found`. Exportar `MSYS_NO_PATHCONV=1`.

⚠️ **Pior que isso:** um script de sonda que leia `j.codeSnippets || []` sem checar o status transforma o 404 em "zero trechos" — foram quatro medições falsas antes de alguém desconfiar. **Cheque o status antes de ler o corpo.**
