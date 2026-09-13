---
name: ctx-7
description: Consulta de documentação pelo Context7 no crivo — a integração é REST e nunca MCP (DM-0, com o par de números), as três camadas (cliente puro em core/, handlers com memo e cota em main/, quatro telas no renderer), estado de tela vs AppError, a chave do memo de sessão que inclui a amplitude, `rules` que se exibe e nunca se envia, a chave exigida e os dois contadores de cota, e o fato de que a pergunta sai da máquina mesmo em conversa local. Use ao tocar `core/context7/`, `main/features/context7/` ou `renderer/features/docs/`, ao mexer na consulta, na cota ou no painel de documentação, e ao avaliar trazer MCP de volta. Não cobre o contrato dos canais `docs:*` (skill `ipc`) nem camadas (skill `architecture`).
---

# Context7 — consulta de documentação

> Arco 23, onze cortes, set/2026. **O fio medido** (rotas, campos, sentinelas, cota) está em [`api.md`](api.md); **a interface como ficou** (quatro telas, onze textos de falha) está em [`painel.md`](painel.md). Aqui fica o que decide a primeira linha.
>
> O material de **entrada** do arco — as 32 decisões `DM-n` fechadas antes de existir código, as sondas com data, o mock do painel — é leitura histórica em [`docs/reference/context7/`](../../../docs/reference/context7/README.md), marcado `⛔ consumido`. Narrativa de cada corte: [`HISTORY.md`](../../../docs/HISTORY.md); índice por sigla: [`DECISOES.md`](../../../docs/DECISOES.md).

## REST, nunca MCP — e é a decisão que alguém vai tentar reabrir

O Context7 entra pela **REST API pública**. Nenhum provedor precisa declarar `tools`, nenhum modelo decide consultar, e **não existe loop de *tool calling* neste app**.

| | Custo |
|---|---|
| Definir as duas ferramentas MCP | **2.060 tokens**, reenviados em **toda** requisição |
| Uma resposta inteira de `/v2/context` | **352 a 1.244 tokens** (n=6) |

A resposta completa custa entre um sexto e seis décimos do que o MCP cobra **só para existir**. Guarde o par de números: sem ele, a conversa vira preferência.

O argumento estrutural é outro e pesa igual: as ferramentas MCP aceitam **duas strings cada** e devolvem prosa num `content[]`; a REST aceita quatro parâmetros e devolve estrutura com o custo de cada trecho contado. **Pelo MCP se trunca; pela REST se seleciona** — e selecionar é o que o [`ESCOPO`](../../../docs/ESCOPO.md) fixou como seção de produto.

⚠️ **O que se perde é o acionamento pelo modelo, e isso é deliberado.** Quem pede a documentação é o usuário. Se agência virar requisito, o caminho **não** é MCP: é uma ferramenta local única — `consultar_documentacao(biblioteca, pergunta)` — cujo corpo faz a mesma chamada REST, custa ~200 tokens de definição em vez de 2.060, devolve o objeto que o painel já sabe desenhar, e serve qualquer provedor com `tools`. Corte futuro **sobre** a REST, nunca alternativa a ela.

## Onde cada peça mora

```text
core/context7/          client.ts · parse.ts · part.ts · types.ts · __fixtures__/
main/features/context7/ handlers.ts · cache.ts (memo de sessão) · quota.ts
renderer/features/docs/ quatro telas, o provider, os hooks
```

`core/` é **puro**: `fetch` injetado por parâmetro, nível 1, roda sem rede. O SDK oficial foi **descartado** — empurraria o cliente para `main/`, fora da meta de 85%, e para o risco de ESM no bundle (D23A.1, DM-26).

⚠️ **`CONTEXT7_BASE_URL` fica em `core/`, e é exceção nomeada a DM-20.** Aquela regra descreve *adaptador de provedor*, e aqui não há adaptador. Não "conserte" movendo para `main/`.

Os canais `docs:search`/`docs:fetch`/`docs:quota`, a superfície `window.api.docs` e a chave no cofre são da skill [`ipc`](../ipc/SKILL.md) — inclusive o porquê de `quota` não devolver `Result`. Camadas e regra de importação: skill [`architecture`](../architecture/SKILL.md).

## Estado de tela não é erro, e confundir os dois foi o que deu origem a esta regra

| O que acontece | Como viaja |
|---|---|
| `no-libraries` · `empty` · `indexing` · `library-not-found` | **dentro do `value`**, como união discriminada |
| 429 · 401/403 · 5xx · `fetch` recusado · timeout de 30 s | `AppError`, pelo `Result` |

⚠️ **`400` e `404` nunca chegam a `describeUpstreamError`** (D23A.3). Entregues a ele, um erro de digitação vira *"Erro do serviço: 404"* — falha de sistema apresentada no lugar de "tente outro termo". O cliente separa **antes** de qualquer tradução.

⚠️ **E `mapProviderError` não serve aqui** (D23B.5): ele é `Record<AiService>` e distribui dicas sobre Ollama e chave de modelo. `main/features/context7/handlers.ts` tem o próprio `mapDocsError`, que é onde o `TimeoutError` vira `AppError.timeout` — a condição 1 de D23B.1, descumprida do 23-B ao 23-I sem ninguém notar, porque o teto nunca foi atingido.

## A chave do memo de sessão inclui a amplitude, e omiti-la não dá erro nenhum

```ts
`fetch|${libraryId}|${version ?? ''}|${broad ? 'broad' : 'narrow'}|${query}`
```

⚠️ Sem o segmento da amplitude (D23J.4), ligar `consulta ampla` na **mesma** biblioteca com a **mesma** pergunta devolve **a resposta estreita já memoizada**, de graça, com ~5 trechos — e a caixa lê como se não fizesse nada. Não é falha de rede nem erro de tela: é **sucesso silencioso**, a mesma classe do `num_ctx` do Ollama (skill [`ai`](../ai/SKILL.md)).

O memo guarda **só resposta completa**: `indexing` é o estado cujo ponto inteiro é tentar de novo, `empty`/`no-libraries` deixam a pessoa reformulando, e falha **nunca** gruda num botão de repetir (D23B.10). `refresh: true` pula a **leitura** e nunca a escrita — senão o botão gratuito seguiria devolvendo a resposta que o pago substituiu (D23I.11).

## `rules` se exibe e nunca se envia

É o único lugar do app onde **exibir e enviar divergem de propósito** (DM-17). `rules` é instrução de terceiro endereçada a um modelo — superfície de injeção —, então o painel a mostra numa aba própria e `partForProvider` não a manda. Descartar em silêncio esconderia a tentativa; é por isso que a aba existe.

⚠️ **As três listas não têm a mesma procedência**, e quem diz isso é a doc oficial: só `libraryOwn` vem do `context7.json` do repositório; `global` e `libraryTeam` são criadas no painel do Context7 e chegam pela chave de **quem consulta**. A aba nomeia a procedência de cada grupo (D23F.8) — chamar de alheia uma regra que o próprio dono da chave escreveu seria falso. É também por que 11 sondas anônimas não podiam ter visto nenhuma.

## Cota e chave — o recurso escasso desta feature

- **A chave é exigida** para consultar (D23I.5). Sem ela o `Consultar` trava e a primeira tela explica; o item `Documentação` do menu `+` **continua abrindo o painel**, porque é lá que a explicação cabe.
- **Anônimo (200/mês) e com-chave (1.000/mês) são contadores separados** — medido no 23-I, e a prova é a repetição: cada contador caiu exatamente 1. ⚠️ **Separados não quer dizer somáveis** (D23I.13): cair para o anônimo quando a chave esgota reintroduz o silêncio que motivou exigir a chave. Se um dia os 200 forem usados, que seja recuo **anunciado**.
- **Não existe endpoint de cota.** O número só vem do header da última resposta, então antes da primeira consulta da sessão **não há número** — a tela diz `sem consulta nesta sessão`, nunca zero (D23I.7).
- **Cancelar não devolve cota**, e é esse o argumento que fez `docs:fetch` ser `invoke` simples e não job (D23B.1): a requisição é contada quando chega lá. Gatilho de reversão **medido e não disparado** — `/vercel/next.js` com `fast=false` levou 2.222 ms contra um teto de 30 s.

## A pergunta sai da máquina, inclusive em conversa local

`query` vai **como escrita** (DM-22) — é ela que ordena o resultado, e extrair termos degradaria o que o serviço faz bem. A consequência é de fronteira: **o provedor de IA deixa de ser o único portal de saída**, e uma conversa 100% local passa a mandar texto para um terceiro.

Dono da regra: [`ESCOPO.md`](../../../docs/ESCOPO.md) § *Ferramentas do chat*. O aviso é **permanente sob o campo**, nunca consentimento de uma vez — aviso que se aceita uma vez não está na tela no turno em que o vazamento acontece.

⚠️ **O registro disso não existe ainda.** O Observatório não vê a consulta; o painel de privacidade responde *"o que saiu desta máquina"* e mostra só nuvem-IA. É dívida nomeada do `O-9` ([`ROADMAP § 2`](../../../docs/ROADMAP.md)), aceitável **só porque a divulgação já existe** em dois lugares. Falta o registro, não o aviso.

## Como se testa, e por que a suíte nunca bate na API

| Peça | Nível | Forma |
|---|---|---|
| cliente, parse, seleção de trechos | 1 | `fetch` injetado, fixtures de `core/context7/__fixtures__/` |
| handlers, memo, cota | 3 | funções exportadas, dependências por parâmetro, sem Electron |
| as quatro telas | 2 | jsdom; a classe é atribuída, a cor e o layout não |

⚠️ **Sondar consome a mesma cota que usar.** As sondas do arco levaram o contador anônimo de 200 a 144 em poucos dias. As fixtures foram gravadas **uma vez** contra a API real — inclusive a de `fast=true`, com 25 trechos — e todo teste roda contra elas.

⚠️ **Fixture vem da resposta real, nunca do `openapi.json`.** O schema publicado está atrás da API (`generationDate` e `searchFilterApplied` voltaram sem estar nele). Fixture derivada do schema testaria o schema, não a API.

## As armadilhas deste assunto

- **`DocsFailure.tsx` ao lado de `docsFailure.ts` colide no Windows** — o import do componente resolve para o módulo puro, e caem dezenas de testes com `Element type is invalid`, em arquivos que nem tocam o componente. `typecheck` e `lint` concordam com o import. A convenção do projeto (componente em PascalCase, módulo puro em camelCase) **cria** a colisão sempre que o par compartilha o substantivo.
- **Um painel que se desenha não é um painel que ocupa a região** — todo estado-que-faz-renderizar do provider passa por `open ? valor : null`, senão dois `<aside>` aparecem juntos (skill [`architecture`](../architecture/SKILL.md)).
- **O título e a descrição do trecho são markdown**, e vão pelo `MarkdownMessage` — o título na forma `inline`, que não declara `font-size` (skill [`design-system`](../design-system/SKILL.md)).

Todas com sintoma e conserto em [`ARMADILHAS.md`](../../../docs/ARMADILHAS.md), buscáveis pelo sintoma.
