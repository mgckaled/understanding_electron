# Context7 — a API, medida

> Anexo de [`README.md`](README.md). O que foi sondado contra a API real, o que veio da fonte primária e o que segue sem verificação. **É o material do corte 23-A** — quem estiver construindo o cliente lê este arquivo, não o guia inteiro.

---

## A REST API, contra fonte primária

`openapi.json` do repositório oficial e o guia de API publicado.

| Operação | Endpoint |
|---|---|
| buscar biblioteca | `GET /api/v2/libs/search` — `libraryName`, `query`, `fast` |
| buscar documentação | `GET /api/v2/context` — `libraryId`, `query`, `type`, `fast` |

- **Autenticação:** `Authorization: Bearer ctx7sk…`, **opcional**. O `/v2/context` é público por padrão, salvo se um `API_KEY` global estiver configurado no servidor — foi por isso que a sonda sem chave funcionou.
- **`type`**: `json` ou `txt`, **default `txt`** — confirmado na documentação oficial. O SDK declara `json` porque é o default *dele*, não o da API: quem chama por `fetch` e omite o parâmetro recebe texto.
- **`fast`**: `true` pula o reranking por LLM do lado deles.
- **Versão:** `libraryId` aceita `/owner/repo/v15.1.8` ou `/owner/repo@v15.1.8`.
- **Status:** `202` biblioteca não finalizada · `301` com `redirectUrl` · `429` com `Retry-After` e `RateLimit-*` · erros em `{ error, message }`.

### `ContextResponse`, do `openapi.json`

```
codeSnippets[]  (obrigatório) → codeTitle · codeDescription · codeLanguage
                                codeTokens · codeId · pageTitle · codeList[]
                                isDynamic? · sourceFile?
infoSnippets[]  (obrigatório) → pageId · breadcrumb? · content · contentTokens
rules?          (opcional)    → global[] · libraryOwn[] · libraryTeam[]
```

⚠️ **Não há paginação — RESOLVIDO.** O schema oficial tem exatamente estas três propriedades. Sem `page`, sem `hasNext`, sem `total`. Fontes secundárias que citam "até 10 páginas" descrevem a v1, deprecada; a v1 também tinha `tokens` e `topic`, que a v2 não tem. O controle de tamanho na v2 não é parâmetro de requisição: é seleção do lado do cliente.

### `/v2/libs/search` — o que volta, e por que importa

```
results[] → id · title · description · branch · lastUpdateDate · state
            totalTokens · totalSnippets · stars · trustScore
            benchmarkScore · versions[]
```

Para `next.js`: `totalTokens: 824953`, `totalSnippets: 3336`, `trustScore: 10`, `benchmarkScore: 91.1`, `state: "finalized"`, `branch: "canary"`, três versões fixáveis.

Dois usos que este payload habilita e que não estavam previstos:

1. **Desambiguar antes de gastar a segunda chamada.** Um nome ambíguo devolve várias bibliotecas plausíveis — buscar "Context7" pelas ferramentas MCP trouxe cinco. `trustScore`, `benchmarkScore` e `stars` são o material para escolher, automaticamente ou mostrando ao usuário.
2. **`state` explica o `202`.** `finalized` é o caminho feliz; os demais estados são o que o `202` sinaliza no `/v2/context`.

⚠️ **`totalTokens` é a biblioteca inteira, não a resposta.** 825k tokens no Next.js contra as centenas medidas numa consulta — a fatia fica na ordem de 0,1%. Não confundir os dois números.

#### Sondado de verdade em 07/09/2026 — 13 chamadas

Até aqui este payload vinha da documentação colada pelo dono, nunca de chamada própria. Foi sondado, e **cinco achados contrariam o que se supunha**.

| # | Achado | Consequência |
|---|---|---|
| 1 | **`id` não é único dentro da mesma resposta.** `/tanstack/query` volta **duas vezes**, diferindo só em `benchmarkScore` (89,48 e 89,01) e `totalSnippets` (2.526 e 3.241) | `id` não serve de `key` do React nem de identidade de seleção. Usar índice, ou o par `id`+`benchmarkScore` |
| 2 | **A ordem não é estável entre chamadas idênticas.** Quatro corridas seguidas da mesma consulta: três iguais, a quarta com as posições 1 e 2 trocadas. Repetido em `duckdb` | "o primeiro resultado" não é conceito estável. Escolher automaticamente pelo topo é escolher por sorteio |
| 3 | **A ordem não segue `trustScore` nem `benchmarkScore`.** `tanstack query`: trust `[8, 10, 8, 9.4, 9.4]`, bench `[89.48, 78.8, 89.01, 86.69, 86.19]` — nenhum dos dois decrescente. Idem em `duckdb` e `react` | ordenar do lado do app é o que dá previsibilidade; a ordem da API não a tem |
| 4 | **`limit` e `page` são ignorados.** `limit=2`, `limit=20` e `page=2` devolvem os mesmos 5 | confirma a ausência de paginação também na busca. O teto observado é **5**; `unpdf` devolveu 3, então é "até 5", não página fixa |
| 5 | **`versions[]` não é ordenável nem homogêneo.** `/tanstack/query`: `["v5.60.5", "v5.71.10", "v5_84_1", "v4_29_19", "v5.90.3"]` — dois separadores na mesma lista e fora de ordem. `/vercel/next.js` traz 16 entradas, duas delas `"__branch__01-02-copy_58398"` e `"__branch__15-6-0-canary-57"`; `/reactjs/react.dev` traz **só** `"__branch__v18"` | **"mais recente" não é calculável.** Ordenar por semver quebra no `_`; filtrar `__branch__*` é obrigatório antes de exibir |

Mais três, menores mas de código:

- **Sem correspondência é `404`, não lista vazia:** `{"error":"no_libraries_found","message":"No libraries found for \\"…\\". Try a different search term."}`. Consulta vazia é `400` `{"error":"validation_error","message":"Library name is required"}`. Os dois são **estado de tela**, não falha de rede — refina DM-12: o cliente precisa distinguir 404/400 de um 5xx antes de `describeUpstreamError`.
- **`stars: -1` é sentinela**, não contagem: aparece em todo `/websites/*` (`/websites/duckdb`, `/websites/duckdb_current`). Exibir cru mostraria "−1 estrelas".
- **`searchFilterApplied: false`** é campo booleano no topo, ausente do `openapi.json` — a mesma defasagem de schema já vista com `generationDate`.

`Ratelimit-Limit: 200` confirmado no header de toda resposta anônima, com `Ratelimit-Remaining` caindo de 1 em 1 por chamada.

### Os dois formatos, lado a lado

O mesmo trecho, nos dois `type`:

| | `json` | `txt` |
|---|---|---|
| Custo por trecho | `codeTokens`, `contentTokens` | — |
| Identificador | `codeId` (URL **ou** id relativo — ver aviso), `pageId` | — |
| Linguagem | `codeLanguage`, e `codeList[].language` | só a cerca do bloco |
| Hierarquia | `breadcrumb` (`Examples > With no SSR`), `pageTitle` | — |
| **URL da fonte** | em `codeId`, com ressalva | `Source: https://github.com/vercel/next.js/blob/canary/docs/01-app/…` |
| Separador entre trechos | array | linha de hifens |

⚠️ **`codeId` tem formato variável, e é o único portador da procedência no `json` — RESOLVIDO (DM-27).** Sonda real de 06/09/2026 devolveu `codeId` como **URL completa** (`https://github.com/vercel/next.js/blob/canary/docs/01-app/03-api-reference/06-cli/create-next-app.mdx`), enquanto o exemplo da documentação oficial mostra o mesmo campo como id relativo com âncora (`lazy-loading.mdx#_snippet_7`). Os dois formatos são reais; presumir um deles quebra no outro. **Tentar `new URL(codeId)` e tratar a falha como "sem link"** é o único tratamento seguro.

⚠️ **`sourceFile` não é o caminho.** O `openapi.json` o prevê como opcional em `CodeSnippet`; na segunda sonda veio **ausente nos 3 trechos de código**. Não construir nada sobre ele.

⚠️ **`infoSnippets` não tem procedência nenhuma.** Só `pageId` (nome do arquivo), `breadcrumb`, `content` e `contentTokens` — sem URL, em formato nenhum. Se o painel mostrar link, ele existe para trecho de código e não para trecho de prosa; a interface tem de aguentar a assimetria.

A sonda também trouxe `generationDate` em `codeSnippets[]`, campo que não está no `openapi.json` nem no exemplo oficial — sinal de que o schema publicado está atrás da API real.

⚠️ **Existe um SDK TypeScript oficial** (`getContext(query, libraryId, options)`), com `signal`, `timeout` e `cache` nas opções. É dependência nova; os três adaptadores de IA deste projeto usam `fetch` cru. Ver DM-26.

⚠️ **A v1 foi deprecada com 404 silencioso** (`upstash/context7#981`, MCP e CLI apontando para `/api/projects`). Versão de endpoint se fixa e se reconfere.

---

---

## Medições (06/09/2026)

Números reais. Remeça antes de citar em outro lugar.

| O que | Valor | Como |
|---|---|---|
| Definição das duas ferramentas MCP | 2.060 tokens (1,3k + 760) | `/context` do Claude Code |
| `/v2/context` `type=json`, sem chave, `/vercel/next.js` | **352 · 381 · 772 · 939 · 1.060 · 1.244** tokens | seis chamadas reais, perguntas de amplitudes diferentes |
| Trechos por resposta | **sempre 4 ou 5**, qualquer que seja a amplitude | idem |
| Maior trecho isolado visto | **620 tokens** | idem |
| `rules` | ausente em **6 de 6** | idem |
| Limite anônimo (sem chave) | `Ratelimit-Limit: 200` | header da resposta |
| Limite gratuito | 1.000 chamadas/mês · 60/hora · 20 bônus/dia quando bloqueado | documentação |
| Plano pago | US$ 7 por assento/mês, 5.000 chamadas; excedente US$ 10/mil | idem |
| Consumo real do dono do projeto | **77/1.000 no mês**, pico de 32 num dia | painel da conta |

⚠️ **O teto gratuito não é o gargalo.** O uso medido é ~8% da cota mensal, e isso em sessões de Claude Code, que consultam documentação muito mais do que uma conversa no crivo consultaria. `search` e `fetch docs` **não** são 1:1 — no dia de pico, ~23 buscas para ~9 consultas.

### Frota Ollama — inventário refeito

`/api/show` por modelo, `ollama ps` vazio antes e depois. Substitui a lista da skill [`ai`](../../../.claude/skills/ai/SKILL.md).

| Modelo | Capacidades | Teto treinado |
|---|---|---|
| `qwen3.5:2b` | completion · vision · tools · thinking | 262.144 |
| `qwen3:4b` | completion · tools · thinking | 262.144 |
| `qwen2.5-coder:3b` | completion · tools · insert | 32.768 |
| `qwen2.5-coder:7b` | completion · tools · insert | 32.768 |
| `qwen2.5:7b` | completion · tools | 32.768 |
| `gemma3:4b` | completion · vision | 131.072 |
| `gemma3:1b` | completion | 32.768 |

Os quatro `*-custom` instalados são clones do app irmão e caem em `dropRedundantVariants`.

---

---

## Três achados que mudam o desenho, não o detalhe

### 1. O modelo padrão do aplicativo não tem `tools`

Cinco dos sete modelos declaram `tools` — mais do que se supunha. Mas o `gemma3:4b`, que é o **default** e um dos dois com `vision`, **não declara**. Pela via MCP, a feature ficaria indisponível justamente no modelo padrão; pela REST funciona nos sete, incluindo o `gemma3:1b`.

### 2. O tamanho da resposta tem teto próprio, e a amplitude da pergunta quase não o move

Seis sondas contra o Next.js (825k tokens, 3.336 trechos), de "routing" a uma pergunta multi-tópico deliberadamente vaga: **sempre 4 ou 5 trechos**, total entre **352 e 1.244 tokens**. O Context7 rerankeia e corta do lado dele; a amplitude muda o conteúdo, não a ordem de grandeza.

Isso desfaz o problema que motivava DM-16. Não há explosão a conter: qualquer resposta cabe folgada na menor faixa de `CONTEXT_BANDS` (4096), e o precedente de `DocumentPart` — inline, reenviado inteiro — serve sem adaptação.

⚠️ **`codeLanguage` não é normalizado.** Uma mesma resposta trouxe `TypeScript`, `typescript` e `javascript`; outra, `tsx`, `jsx`, `typescript` e `bash`. Filtrar por linguagem exige normalizar caixa **e** decidir se `tsx` conta como TypeScript — o que encarece justamente a dimensão de DM-16 que parecia mais barata.

### 3. `rules` é superfície de injeção, e o MCP a esconde

`rules.global`, `rules.libraryOwn`, `rules.libraryTeam` são instruções em texto, escritas por quem publica a biblioteca, destinadas a serem obedecidas por um modelo. Não vieram na amostra, mas o schema oficial as prevê como campo de primeira classe.

Pela via MCP elas chegam embutidas na prosa do `content[]`, indistinguíveis do resto. Pela REST vêm num campo próprio, e descartá-las é uma linha.

---

---

## Verificações já feitas — não repetir

- `/v2/context` responde **sem** chave (público por padrão).
- O `openapi.json` oficial **não** tem paginação.
- `ContextResponse` traz `codeTokens` e `contentTokens` por trecho.
- Capacidades e teto treinado dos sete modelos da frota, por `/api/show`.
- `PanelKind` tem dois inquilinos; `onShortcut` e `width` por inquilino já existem.
- `SidePanel`, `Tabs`, `StateView`/`ViewState` e o `Record<ErrorKind, string>` de `messages.ts` já são primitivos — nada de casca a construir.
- `MessageList` despacha por helpers `*PartOf(message)`, não por `switch` de `kind`.
- `status: 'empty'` é usado em dez lugares para "resultado válido e vazio", com texto por caso.
- `conversationWindow` só trava com `costed && locked && reserved !== undefined`, e decide janela, não conteúdo.
- O painel de artefato **já mistura densidades**: `ArtifactBody` em `text-reading`, `ArtifactSteps`/`ArtifactDataset`/`ArtifactPicker` em `text-xs`/`text-sm`/`text-2xs`.
- URL de serviço externo mora como constante *module-level* no adaptador (`GLM_ENDPOINT`, `OLLAMA_HOST`, `GEMINI_INTERACTIONS_URL`), não em `core/`.
- `ArtifactPanel.tsx` e `DraftPanel.tsx` são os dois únicos consumidores de `SidePanel`.
- `checkExternalUrl` é só para `shell.openExternal`, não para `fetch`.
- Consumo real da conta gratuita: 77/1.000 no mês.
- Default de `type` é **`txt`** — o `json` do SDK é default do SDK, não da API.
- O `txt` traz `Source: <url>` por trecho; no `json` a URL vem em `codeId`, que tem dois formatos reais (URL completa e id relativo com âncora).
- `sourceFile` veio ausente nos 3 trechos da segunda sonda; `generationDate` veio sem estar no `openapi.json`.
- `infoSnippets` não carrega URL em formato nenhum.
- Segunda medição de resposta: 3 code + 2 info = **352 tokens** (a primeira deu 939).
- Seis sondas de tamanho, de pergunta específica a ampla: 4–5 trechos sempre, 352–1.244 tokens.
- ⚠️ **Armadilha de sonda, não do serviço:** o Git Bash converte `libraryId=/vercel/next.js` em caminho do Windows (`/c:/program files`), e a API responde 404 `library_not_found`. Exportar `MSYS_NO_PATHCONV=1`. Pior: um script de sonda que lê `j.codeSnippets||[]` sem checar o status transforma o 404 em "zero trechos" — quatro medições falsas antes de alguém desconfiar.
- `search` devolve `totalTokens`/`totalSnippets`/`trustScore`/`benchmarkScore`/`versions`/`state` — **sondado em 07/09/2026**, 13 chamadas, com cinco achados que contrariam o suposto; ver § *Sondado de verdade*. O parâmetro que funcionou é `query`; `libraryName` e `fast` seguem sem sonda neste endpoint.

---

## O que ainda não foi verificado

- Se `fast=true` muda a quantidade de trechos ou só a ordem.
- Comportamento do `202` (biblioteca não finalizada) na prática, e quais `state` além de `finalized` existem.
- Se `rules` aparece com frequência, e em que bibliotecas.
- Limite de taxa por endpoint (o painel conta `search` e `fetch docs` separadamente; a cota parece somar os dois). **Parcialmente resolvido em 07/09/2026:** a janela anônima é mensal — `Ratelimit-Reset` apontou para a virada do mês — e `Ratelimit-Remaining` decrementou de 1 em 1 nas chamadas de busca. Falta confirmar se `/v2/context` consome o mesmo contador.
- O parâmetro `libraryName` do `/v2/libs/search`: a documentação o cita, mas as 13 sondas usaram `query`.
- Se a duplicata de `id` (`/tanstack/query` duas vezes) também acontece no `/v2/context`, ou só na busca.
- **Nada do painel foi verificado ao vivo** — o desenho da § *O painel* é alvo, e a comparação de silhueta dos três ícones do cabeçalho é a primeira coisa a olhar renderizada.
