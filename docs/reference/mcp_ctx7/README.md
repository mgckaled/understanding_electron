# Context7 — guia de implementação (arco 23)

> Esboço, não versão final. As decisões abaixo estão **em aberto**; este documento é atualizado conforme cada uma é tomada, como o [`reference/reasoning/README.md`](../reasoning/README.md) foi durante o arco 21. Nada aqui é premissa fixa exceto o que estiver marcado **DECIDIDO**.
>
> Siglas `DM-n` são provisórias. A definitiva (`D23.n`) nasce com o plano.

## Por que este documento existe em vez de `plan/active/23.md`

Porque o guia anterior — [`web-fetch-mcp-thinking/README.md`](../web-fetch-mcp-thinking/README.md) — foi escrito **antes** de olhar o código e o protocolo, e errou na premissa: propunha *tool calling* como espinha dorsal comum de três capacidades, premissa que RE6.4 derrubou com o resultado do arco 21. Ele também descreve um app com um provedor só, um orçamento de RAM chumbado em 7 GB e uma API (`ollama.chat`) que este projeto não usa.

O padrão que funcionou no arco 21 foi o oposto: levantar contra o código e contra a fonte primária, medir o que dá para medir, e listar explicitamente o que ficou por verificar. É o que este documento faz.

O guia antigo será marcado `⛔ consumido` quando este substituí-lo.

---

## DECIDIDO — DM-0: REST, não MCP

O Context7 entra pela **REST API pública**, não pelo protocolo MCP.

A consequência atravessa o arco inteiro: consultar documentação deixa de ser **capacidade do modelo** e passa a ser **operação do aplicativo**. Ninguém precisa de `tools`; nenhum provedor precisa saber que o Context7 existe; não há loop de *tool calling* a construir.

### O par de números que decidiu

| | Custo |
|---|---|
| Definir as duas ferramentas MCP | **2.060 tokens**, reenviados em toda requisição |
| Uma resposta inteira de `/v2/context` | **352 a 1.244 tokens** (n=6) |

A resposta completa custa entre um sexto e seis décimos do que o MCP cobra só para existir.

### O argumento estrutural

As ferramentas MCP aceitam **duas strings cada** (`resolve-library-id`: `libraryName`, `query` · `query-docs`: `libraryId`, `query`) e devolvem prosa num `content[]`. A REST aceita quatro parâmetros e devolve estrutura com o custo de cada trecho contado. **As ferramentas MCP são um envelope que esconde os parâmetros da REST.**

Pelo MCP se trunca; pela REST se seleciona — e selecionar é o princípio que o [`ESCOPO`](../../ESCOPO.md) já fixou como seção de produto: *o app nunca deixa o modelo decidir em silêncio o que descartar*.

### O que se perde, e por que é aceitável

O acionamento pelo modelo. Quem pede a documentação passa a ser o usuário.

RE6.4 já registra que nenhum caminho de acionamento é canônico, e o precedente que desautoriza presumir *tool calling* é o raciocínio visível — entregue, e por outro caminho em todos os provedores. Some-se que um modelo de 2B decidindo sozinho quando consultar documentação é a parte menos confiável do arranjo.

**O loop de *tool calling* não se constrói aqui.** Se for necessário depois — pilar de código, arco 22 por *tool calling* —, nasce lá, num plano que o justifique.

### Consequências a executar junto do plano

1. O pilar muda de nome no `ESCOPO`: "Documentação (MCP)" → "Documentação (Context7)".
2. Esta pasta muda de nome junto; os apontadores são tocados na mesma edição.
3. `DM-19` (a chave) é revista — ver medições.

---

## Estado atual do código (confirmado lendo, 06/09/2026)

| Peça | Como está | Onde isto encaixa |
|---|---|---|
| `PanelKind` (`features/panel/panelContext.ts`) | `'artifact' \| 'draft'` | ganha um terceiro inquilino; `raise`/`toggle`/`close`/`release`, `width` por inquilino e `onShortcut` já existem |
| `StepProposalLine.tsx` | linha-botão na transcrição que chama `toggle(target, event.currentTarget, messageId)` | molde exato da linha na conversa (DF3F.1/DF3F.2) |
| `DocumentPart` (`shared/ipc.ts`) | `{ kind, hash, fileName, format, text }` — texto **inline** | molde da forma do dado |
| `partForProvider` (`core/ai/messages.ts`) | `switch` por `kind`; `document → formatDocumentCard` | um `case` novo |
| `AttachmentPart` | `DatasetPart \| DocumentPart \| ImagePart` | o comentário convida um quarto membro — mas ver DM-23 |
| `checkExternalUrl` (`core/url.ts`, 33 linhas) | valida esquema para `shell.openExternal` | **não** está no caminho: host fixo, é `fetch`, e não é o SO resolvendo protocolo |
| `describeUpstreamError` (`core/ai/upstreamError.ts`) | trata `{error: string}` e `{error: {message}}` por classe de status | a forma do Context7 é `{ error, message }` — cai no fallback de classe hoje |
| `SidePanel` (`shared/ui/`) | primitivo desde o E-1-B: `<aside>`, fade, resizer, foco ao abrir, `Esc`; `header`/`children` por slot | **a casca do painel já existe** — o arco não desenha estrutura, só conteúdo |
| `Tabs` (`shared/ui/`) | primitivo com `keepMounted` opcional | se o painel tiver abas (trechos · metadados), está pronto |
| `ViewState` / `StateView` (`shared/ui/state.ts`) | seis estados, `loading` com barra determinada quando há `total` | o estado da consulta usa isto, não um booleano |
| `messages.ts` (`shared/ui/`) | `Record<ErrorKind, string>` — `typecheck` falha se faltar entrada | ver DM-12: `AppError` novo **obriga** texto em português |

O achado mais útil está no docstring de `DocumentPart`: o texto vai inline e é **reenviado inteiro todo turno**, por decisão consciente — *"the chat is stateless and resends the transcript every turn, so what must not repeat is the extraction, not the resend."* Na ordem de grandeza medida (centenas de tokens), esse precedente serve direto.

⚠️ **Nada disto é trabalho de design system.** O painel do Context7 **ainda não existe**, e pela régua do envelope (skill [`design-system`](../../../.claude/skills/design-system/SKILL.md)) o que não existe nasce no plano da própria feature, já vestido. As peças acima estão prontas para ser usadas, não para ser construídas.

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
| `rules` | ausente nas duas | idem |
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

## Decisões — recomendação e base

Recomendações, não decisões tomadas: só DM-0 e DM-27 estão fechadas. Cada uma declara **em que se apoia**, porque a força varia:

| Rótulo | Significa |
|---|---|
| *(medida)* | sonda própria contra a API ou contra a máquina, nesta investigação |
| *(precedente)* | o código já resolve um caso igual, e a recomendação é copiá-lo |
| *(juízo)* | escolha de produto — nenhuma sondagem a resolve |

### Dissolvidas pela medição de tamanho

Quatro deixaram de ter objeto quando as seis sondas mostraram 4–5 trechos e ≤1.244 tokens, sempre.

- **DM-16 · Critério de seleção → não construir seleção** *(medida)*. Não há o que selecionar: a resposta cabe folgada na menor faixa de `CONTEXT_BANDS`. E a dimensão que parecia mais barata é a mais cara — `codeLanguage` não é normalizado (`TypeScript`, `typescript`, `tsx`, `jsx` na mesma resposta), então filtrar exigiria normalizar caixa e decidir se `tsx` conta como TypeScript, sem comprar nada.
- **DM-25 · Painel → leitura apenas** *(medida)*. Consequência da anterior: sem seleção, não há o que interagir. **O corte 23-C não nasce.**
- **DM-4 · Faixa mínima → não existe** *(precedente)*. `conversationWindow` decide o tamanho da janela; uma consulta não mexe em `numCtx`, só aumenta `estimated`, que é assunto do `budgetFor`. Nada a impor.
- **DM-11 · Conversa travada → nenhum caminho especial** *(precedente)*. A trava só morde com `costed && locked && reserved !== undefined`, e decide janela, não conteúdo. É o mesmo trajeto de um documento anexado grande.

### Forma do dado

- **DM-23 · Variante própria, nunca `AttachmentPart`** *(precedente)*. `MessageList` não faz `switch` por `kind`: despacha por helpers `*PartOf(message)` — `attachmentPartOf`, `reasoningPartOf`, `stepProposalPartOf` —, cada um com seu componente. A variante custa três coisas conhecidas: schema em `shared/ipc.ts`, `docsPartOf` em `core/ai/messages.ts`, componente próprio. Entrar em `AttachmentPart` significaria renderizar como cartão de anexo, que é o que isto não é.
- **DM-6 · Reenvio → molde `DocumentPart`, inline e inteiro** *(medida + precedente)*. A coluna `parts` é `TEXT` com JSON, e o docstring de `DocumentPart` registra a decisão consciente de reenviar a extração todo turno. Com ≤1,3k tokens, copia-se.
- **DM-14 · Inline em `parts`, sem `userData`** *(precedente)*. `DatasetPart` e `ImagePart` usam `userData/attachments/<hash>` porque carregam bytes; aqui é texto.

### Conteúdo e privacidade

- **DM-17 · `rules` → descartar, com comentário** *(medida + juízo)*. Ausente em 6 de 6 sondas, mas o schema a prevê: se chegar, é instrução de terceiro endereçada ao modelo. Descartar com três linhas citando a decisão.
- **DM-22 · A pergunta vai como o usuário escreveu** *(juízo)*. É o `query` que faz o reranking; um termo extraído degradaria justamente o que o serviço faz bem. Registrar no `ESCOPO` que consultar documentação envia a pergunta a um terceiro, mesmo em conversa local.

### Rede, erro e segredo

- **DM-26 · `fetch` cru, não o SDK** *(precedente)*. Mantém o cliente em nível 1 e dentro da meta de 85% de `core/`, como `core/ai/` roda sem Ollama instalado; o SDK o empurraria para `main/`, sem meta, e para o risco de ESM no bundle (DE1D.9).
- **DM-20 · Constante no adaptador, não em `core/`** *(precedente)*. O padrão real é `GLM_ENDPOINT`, `OLLAMA_HOST` e `GEMINI_INTERACTIONS_URL` como constantes *module-level* nos adaptadores de `main/features/ai/providers/`.
- **DM-12 · `AppError` só para falha de rede** *(precedente)*. `upstream` já existe e `errorMessage` devolve `error.message` para ele. "Biblioteca não encontrada" e `202` são **estado de tela** via `ViewState` — `status: 'empty'` aparece em dez lugares para exatamente isso, com texto próprio (`ArtifactDataset`: *"Arquivo sem linhas de dado."*). Nenhum `kind` novo, nenhuma entrada em `messages.ts`.
- **DM-19 · Chave opcional** *(medida)*. Anônimo traz `Ratelimit-Limit: 200` no header, e o consumo real do dono é 77/1.000 mensais. Oferecer o campo, não exigir.
- **DM-18 · `fast=false`** *(juízo)*. O gargalo do projeto é janela de contexto, não latência; ordenação melhor por alguns segundos é a troca certa.
- **DM-24 · Registrar a exceção no código** *(precedente)*. Duas linhas no cliente: host fixo, é `fetch`, `checkExternalUrl` existe para `shell.openExternal`. Impede que o próximo leitor procure um bypass inexistente.

### Interface

- **DM-29 · O gatilho não tem peça** *(precedente contrário)*. O `AttachButton` tem `mcp` como `<Switch>` desabilitado no grupo Ferramentas — e um interruptor não serve a uma ação (DM-15). Vira botão no mesmo grupo? Abre um campo? Um modal? Sem isto o arco não tem porta de entrada.
- **DM-30 · Onde o usuário digita a biblioteca, e quem desfaz a ambiguidade** *(juízo)*. Automático por `trustScore`/`benchmarkScore`, ou lista para o usuário escolher. Muda o número de telas de 23-B.
- **DM-31 · Consulta repetida** *(medida)*. Duas perguntas sobre a mesma biblioteca geram duas partes, ambas reenviadas todo turno — o custo fixo dobra. Deduplicar por `libraryId`, substituir a anterior, ou deixar acumular e confiar no `budgetFor`.

- **DM-21 · `DocsPanel.tsx`, ao lado de `ArtifactPanel` e `DraftPanel`** *(precedente)*. Os dois são hoje os únicos consumidores de `SidePanel`. Mostra biblioteca, versão, a pergunta e os trechos com `codeTokens`, com link quando `codeId` parseia como URL. Sem seção de "descartado" — nada é descartado.
- **DM-28 · Metadados em chrome, trecho em leitura** *(precedente)*. Não é régua a aplicar, é o vizinho a copiar: `ArtifactBody.tsx` usa `text-reading` no corpo enquanto `ArtifactSteps`/`ArtifactDataset`/`ArtifactPicker` usam `text-xs`/`text-sm`/`text-2xs` — o painel de artefato já é misto.
- **DM-15 · Não é interruptor, é uma ação** *(precedente)*. `wantsReasoning` é `useState` no `Composer` passado no `onSend` porque é **modo** do envio. Consultar documentação é ato pontual cujo resultado persiste na transcrição.

### Encerradas por DM-0

`DM-1` (caminho do Gemini) · `DM-2` (MCP server-side) · `DM-3` (loop nos três provedores) · `DM-5` (encurtar descrições) · `DM-7` (chamadas paralelas) · `DM-8` (teto de voltas) · `DM-9` (cancelamento no loop) · `DM-10` (timeout do loop) · `DM-13` (capacidade nova no catálogo de nuvem).

⚠️ `DM-1` sai **deste arco**, não do projeto: a Interactions API do Gemini continua pendente por causa do raciocínio (D21A.10), e ela aceita `{ type: 'mcp_server', name, url }` server-side — o Google conectando ao servidor a partir da infraestrutura dele. Se for adotada algum dia, reabre a questão de privacidade que DM-2 fechou aqui.

---

## O fluxo, e onde está o controle

Onze etapas, do gatilho ao orçamento. A coluna que importa é a última.

| # | Etapa | Onde | Controle |
|---|---|---|---|
| 1 | gatilho | renderer | **total** — ⚠️ mas a peça não existe (DM-29) |
| 2 | `GET /v2/libs/search` | `core/context7/` | **parcial** — entrada sim, ranking não |
| 3 | desambiguação | a decidir | **total** — o critério é seu (DM-30) |
| 4 | fixar versão | idem | **parcial** — só entre as indexadas |
| 5 | `GET /v2/context` | `core/context7/` | **mínimo — quatro parâmetros** |
| 6 | tratar a resposta | `core/context7/` | **total** |
| 7 | montar a parte | `shared/ipc.ts` · `core/ai/messages.ts` | total |
| 8 | persistir | `crivo.db`, coluna `parts` | total |
| 9 | renderizar | `MessageList` · `DocsPanel.tsx` | total |
| 10 | enviar ao modelo | `partForProvider` | total |
| 11 | orçamento | `budgetFor` | total — sem caminho especial |

**A forma do controle é uma só: não se modula o que vem, modula-se o que se faz com o que veio.** O Context7 rerankeia e corta do lado dele — sempre 4–5 trechos — e não aceita instrução sobre isso. Não há `limit`, `tokens`, `topic` nem `page` na v2.

O único volante *antes* da resposta é a **pergunta**, e é isso que dá peso a DM-22: `query` é o que ordena o resultado. O que salva o arranjo é o corte deles ser generoso o bastante (≤1.244 tokens medidos); com 30k, a ausência de `limit` seria bloqueante.

Na etapa 5 o app não controla: quantos trechos · quais · em que ordem · o tamanho · se vem `infoSnippets` · se vem `rules` · o formato de `codeId`.

---

## Proposta de cortes

Arquivos separados, estilo 18-A — não passos num arquivo só.

| Corte | Entrega |
|---|---|
| **23-A** | cliente REST em `core/context7/` + `main/features/context7/`, `fetch` injetado, fixtures de JSON capturadas da API real, canais IPC, chave no cofre. Nada visível |
| **23-B** | schema da parte, `docsPartOf`, a linha na conversa, `DocsPanel.tsx` em leitura, o terceiro valor de `PanelKind` |
23-C foi **descartado** por DM-25: sem seleção a construir, não há corte para ele.

---

## Como isto se testa

Pirâmide e limites: skill [`testing`](../../../.claude/skills/testing/SKILL.md).

| Peça | Nível | Forma |
|---|---|---|
| cliente REST, seleção de trechos, parse de `codeId` | 1 | `fetch` injetado, fixtures de JSON — sem rede real |
| handlers dos canais | 3 | funções exportadas, dependências por parâmetro, sem Electron |
| linha na conversa, painel | 2 | jsdom; a classe é atribuída, a cor e o layout não |

⚠️ **A fixture vem da resposta real, nunca do `openapi.json`.** O schema publicado está atrás da API — `generationDate` voltou na sonda sem estar nele. Uma fixture derivada do schema testaria o schema, não a API.

⚠️ **Antes de mandar qualquer asserção do painel para nível 4, verifique se ela cabe sobre a classe.** O veredito "isso só se prova ao vivo" já saiu errado por metade uma vez neste projeto.

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
- `search` devolve `totalTokens`/`totalSnippets`/`trustScore`/`benchmarkScore`/`versions`/`state` — **da documentação oficial, não de sonda**: o `/v2/libs/search` REST ainda não foi chamado nesta investigação.

## O que ainda não foi verificado

- Se `fast=true` muda a quantidade de trechos ou só a ordem.
- Comportamento do `202` (biblioteca não finalizada) na prática, e quais `state` além de `finalized` existem.
- Se `rules` aparece com frequência, e em que bibliotecas.
- Limite de taxa por endpoint (o painel conta `search` e `fetch docs` separadamente; a cota parece somar os dois).
