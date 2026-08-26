# 18-C — Pré-visualização automática

**Depende de:** [18-B — Canal, Arrow e a primeira consulta visível](18-B-canal-e-consulta.md) · **Entrega:** uma tabela de até 50 linhas, sempre visível dentro do `DatasetCard` quando um dataset é anexado — sem clique, sem paginação — reaproveitando o canal `dataset:query` do 18-B, sem tocar seu contrato. Nenhum canal IPC novo.

> Terceiro dos sub-planos do 18. O 18-B deu ao app um jeito de rodar SQL e ver o resultado, atrás de um botão. Este plano é o oposto de propósito: algo que aparece **sem** interação, do mesmo jeito que markdown na resposta do assistente já aparece sem um clique — é a leitura literal da decisão do usuário que abriu este sub-plano: *"a pré-visualização deve funcionar automático como uma renderização markdown"*.

**Fora deste plano:** paginação/"carregar mais" (D18C.1 — decisão de **não** construir, com o motivo) · perfil nível 2 sob demanda + cartão aninhado (18-D) · qualquer formato além de CSV/TSV/TXT (18-D–F) · verificação de sanidade do resultado (coluna nula, zero linhas — dono é o 19, que já reserva "a verificação pós-execução" para a proposta de consulta/passos; a pré-visualização mostra o arquivo cru, não um veredito).

---

## Contexto

A sessão anterior levantou "carregar as próximas 50 linhas, descartando as anteriores" como sugestão, não decisão fechada, e pediu pesquisa sobre se valia o custo. A pesquisa (registrada na conversa, não repetida aqui) achou: `OFFSET` novo a cada página é caro em CSV — sem índice, o motor reprocessa do início ([issue #14218 do próprio DuckDB](https://github.com/duckdb/duckdb/issues/14218)); a alternativa correta seria um cursor de streaming único, mantido vivo, avançando em blocos de 2048 linhas. Mas a decisão do usuário que abriu este sub-plano já respondia a pergunta por outro caminho: a pré-visualização **não é uma ferramenta de navegação** — é um retrato automático, de uma vez, do mesmo jeito que uma resposta em markdown não tem "próximo trecho". Isso torna o cursor de streaming — complexidade real de estado e ciclo de vida — desnecessário aqui. Quem precisa ver além de 50 linhas já tem o SQL cru do 18-B.

Achado que simplifica o desenho: o `DatasetPart` (plano 16) já guarda `rowCount` desde o anexo — a contagem **total** do arquivo, não uma amostra. A pré-visualização não precisa do truque de N+1 que o 18-B usa (D18B.4) para saber se "há mais linhas"; ela já sabe, de graça, comparando `part.rowCount` com 50.

---

## O que a leitura do 18-B implementado mudou neste desenho

O 18-B foi implementado por completo antes desta sessão retomar o 18-C. Três fatos do código real, não do plano do 18-B, mudam o desenho abaixo:

1. **`wrapWithLimit` nunca existiu como nome — mas o canal não precisa de um parâmetro novo para este plano funcionar.** A função real é `buildFinalSql(sql, limit)`, em `core/duckdb/query.ts`, chamada **só dentro de `queryDataset`** (`main/features/dataset/handlers.ts`), contra `const QUERY_ROW_LIMIT = 201` fixo no módulo — o canal em si não expõe `limit` a quem chama. A suposição original deste plano ("chamar com `limit = 50` em vez de `201`") presumia um parâmetro que nunca existiu. **Mas `buildFinalSql` embrulha qualquer `sql` recebido num teto — é um teto, nunca um piso**: `SELECT * FROM (<sql>) LIMIT 201` só pode **reduzir** o que `<sql>` devolveria, nunca aumentar. Como este plano controla o texto do `sql` que envia (não é entrada de usuário), basta pedir `'SELECT * FROM dataset LIMIT 50'` — o resultado composto, `SELECT * FROM (SELECT * FROM dataset LIMIT 50) LIMIT 201`, devolve exatamente 50 linhas. `isReadOnlyQuery` aceita (começa com `SELECT`, sem `;` extra); nada em `buildFinalSql` reescreve ou remove um `LIMIT` interno. Zero campo novo, zero canal tocado — achado corrigido durante a revisão do advisor desta sessão, depois de um primeiro rascunho que chegou a propor estender o contrato (ver diário).
2. **O risco 0 (concorrência) está resolvido, não pendente.** `createDuckdbRunQuery` (`main/duckdb/spawnWorker.ts`, real) serializa toda chamada numa `tail` promise — duas consultas em voo (dois `DatasetCard` disparando pré-visualização ao montar, o cenário exato que o risco 0 descrevia) não trocam mais resposta entre si. Isso já estava resolvido **dentro do 18-B**, não é trabalho deste plano. Só um risco correlato segue aberto e registrado no `HISTORY.md`: se o worker morrer no meio de uma fila (ex.: uma consulta pesada do 18-B estourando os 2GB de `memory_limit` enquanto pré-visualizações estão enfileiradas atrás dela), toda chamada seguinte na mesma `tail` nunca recebe resposta nem erro — UI girando para sempre. Este plano não o resolve (é do 18-B), mas o torna mais alcançável na prática: com pré-visualização automática, "várias consultas na fila" deixa de ser um cenário raro (duplo clique) e passa a ser todo dia (várias mensagens com dataset na mesma conversa).
3. **O jeito certo de ler célula Arrow sem corromper `NULL` já está resolvido e testado — só falta reaproveitar.** `HISTORY.md` registra a armadilha: `Vector.toArray()` troca `NULL` por `0` em silêncio (lê o buffer tipado bruto, sem checar o *bitmap* de validade); só iterar (`[...vector]`, ou `row.toArray()` de uma *row proxy* obtida via `for (const row of table)`) consulta a validade de verdade. `DatasetQueryPanel.tsx` (18-B, real) já implementa isso — `formatCell()` mostra `∅` para `null`/`undefined`, `.toString()` para `bigint`, `String()` para o resto. D18C.6, abaixo, corrigida para reusar essa forma em vez de inventar um segundo marcador visual de `NULL` dentro do mesmo cartão.

---

## Decisões

### D18C.1 — Sem paginação; um retrato único, não um cursor

A pré-visualização dispara **uma** consulta ao montar o card, mostra o que voltou, e não oferece "carregar mais". Três razões, não uma: (1) é a leitura literal da decisão do usuário — automática como markdown, e markdown não pagina; (2) construir um cursor de streaming vivo por card (estado de conexão, ciclo de vida, cancelamento ao desmontar) é complexidade real para uma necessidade que ninguém pediu ainda — especular contra a régua "caro de desfazer" da skill `architecture`, na direção oposta de sempre: aqui o barato **é** não construir; (3) quem precisa ver além da linha 50 já tem o SQL cru do 18-B, que aceita `OFFSET` manual e ocasional — o custo do `OFFSET` só importa para navegação repetida, que este plano não oferece.

### D18C.2 — Reaproveita `dataset:query`; zero canal novo, zero contrato tocado — o teto entra no próprio SQL

`window.api.dataset.query(hash, 'SELECT * FROM dataset LIMIT 50')` — mesmo canal do 18-B, mesma *view* por hash (D18B.3), mesmo transporte Arrow, mesma assinatura de dois argumentos. **Correção sobre dois rascunhos anteriores desta decisão**, nessa ordem: o primeiro presumia um `wrapWithLimit(sql, 50)` exposto ao chamador, que nunca existiu (o nome real, `buildFinalSql`, só é chamado dentro do handler, contra `QUERY_ROW_LIMIT = 201` fixo); o segundo, ao achar isso, propôs estender o contrato do canal com um `limit` opcional — passo extra, handler tocado, canal reaberto um dia depois de fechado. O advisor apontou o caminho mais simples, que os dois rascunhos anteriores não tinham considerado: `buildFinalSql(sql, 201)` embrulha **qualquer** `sql` recebido — `SELECT * FROM (<sql>) LIMIT 201` — e um `LIMIT` é um teto, não um piso; aplicado sobre uma subconsulta que já devolve no máximo 50 linhas, o teto externo de 201 nunca é alcançado. Como este plano controla o texto inteiro do `sql` que envia (não é entrada de usuário livre, ao contrário do 18-B), basta escrever o `LIMIT 50` no próprio SQL. `isReadOnlyQuery('SELECT * FROM dataset LIMIT 50')` aceita (prefixo `SELECT`, sem `;` extra); `buildFinalSql` só faz `trim` + remoção de `;` final + embrulho — nada reescreve um `LIMIT` interno. Nenhum ponto de contato da skill `ipc` é tocado: nem `argsSchema`, nem `Api`, nem o handler, nem `preload`, nem `test/api-mock.ts` — o canal que o 18-B fechou ontem continua fechado.

### D18C.3 — "Há mais linhas" vem do `rowCount` já conhecido, não de uma linha extra pedida

Diferente do 18-B (que não sabe o total de uma consulta livre e por isso pede 201 para descobrir se havia mais), a pré-visualização já tem `part.rowCount` — a contagem exata, gravada no anexo desde o plano 16. `part.rowCount > 50` decide sozinho se o aviso "mostrando as primeiras 50 de N linhas" aparece. Zero linha extra pedida, zero query adicional.

### D18C.4 — Cache por hash via TanStack Query, mesmo padrão de `useAiModels`

```ts
const PREVIEW_KEY = (hash: string) => ['dataset', 'preview', hash] as const
const PREVIEW_QUERY = 'SELECT * FROM dataset LIMIT 50'

const { data, isPending, isError } = useQuery({
  queryKey: PREVIEW_KEY(hash),
  queryFn: () => window.api.dataset.query(hash, PREVIEW_QUERY)
})
```

`data` resolve para `Result<Uint8Array>` — bytes Arrow, não `ArrayBuffer` (correção sobre o rascunho original: é o mesmo tipo que `DatasetQueryPanel.tsx` já consome via `response.value`). A decodificação com `tableFromIPC` acontece no `useMemo` que mapeia para `ViewState<Table>`, mesmo lugar que `useAiModels` filtra o dado antes de expor — nunca dentro de `queryFn`. **`empty` nasce no hook, não no componente** — mesmo `useMemo`, mesma forma de `useAiModels` (que deriva `empty` de uma lista filtrada a zero): aqui, `table.numRows === 0` vira `{ status: 'empty' }` em vez de `ready`. `DatasetPreview` (passo 2) só decide *o que renderizar* para cada estado; não decide se um resultado conta como vazio.

`staleTime: Infinity` — o conteúdo de um hash é imutável por construção (D16.3: conteúdo-endereçado), então, ao contrário de `useAiModels` (que expõe `reload` porque instalar um modelo é um evento do sistema que o app não observa), a pré-visualização **não tem botão de recarregar**: não existe cenário em que o mesmo hash devolva dado diferente amanhã. Efeito colateral que se paga: reabrir uma conversa antiga com o mesmo dataset anexado em duas mensagens (hoje impossível por mensagem, D17.3, mas possível entre conversas diferentes) reaproveita o cache sem nova consulta.

### D18C.5 — Sempre visível dentro do `DatasetCard`; a única seção do card sem clique

> **Superada em parte (ago/2026, correção pós-18-C):** a pré-visualização e o painel "Consultar" duplicavam a mesma tabela quando a consulta padrão rodava — `DatasetCard` agora esconde esta seção enquanto "Consultar" está aberto (nunca as duas visíveis ao mesmo tempo). O disparo automático ao montar, descrito abaixo, não mudou — só a visibilidade simultânea. Ver [`HISTORY.md`](../../HISTORY.md).

O `DatasetCard` acumula, ao fim do arco 18: a linha de chrome (hoje), a pré-visualização (este plano, sempre renderizada), o botão "Consultar" do 18-B (opt-in) e o botão de perfil do 18-D (opt-in). A pré-visualização é a única das quatro sem interação — nasce logo abaixo da linha de chrome, sempre que a consulta devolver algo. Coerente com a linha do `ESCOPO.md` que descreve o artefato de pré-visualização sem nenhuma ação associada.

**Os quatro estados de `useDatasetPreview` (D18C.4) têm que renderizar algo, não só o caminho feliz** — achado da revisão do advisor: uma seção sempre visível que dispara ao montar, sem cobrir `loading`/`error` explicitamente, arrisca a tabela aparecer "do nada" (o cartão muda de altura no meio do primeiro *render*) ou um erro do motor passar em silêncio, sem texto nenhum, numa seção que o usuário nunca clicou para abrir. Mesmo idioma que `ConversationView.tsx` já usa para `ViewState`, não uma convenção nova: `loading` → `<p role="status">Carregando pré-visualização…</p>`; `error` → `<p role="alert">{errorMessage(...)}</p>`; `empty`/`ready` seguem D18C.1–D18C.3 (tabela, ou o texto de "sem linhas" do passo 4). Nenhum esqueleto de tabela — o texto de `loading` é deliberadamente leve, já que a consulta é pequena e cacheada por hash (D18C.4); um placeholder do tamanho da tabela final seria engenharia para um estado que dura frações de segundo na maioria dos casos.

### D18C.6 — `NULL` renderiza distinto de string vazia — reaproveitando a forma real do 18-B, não uma nova

**Correção sobre o rascunho original**, que propunha um marcador próprio (texto `null` em `text-muted`, itálico): `DatasetQueryPanel.tsx` (18-B, real) já resolveu exatamente este problema, com `formatCell()` — `∅` para `null`/`undefined`, `.toString()` para `bigint`, `String()` para o resto — e com leitura por iteração de linha (`for (const row of table) { row.toArray() }`), nunca `vector.toArray()` direto, que troca `NULL` por `0` em silêncio (armadilha registrada no `HISTORY.md`, achada durante o 18-B). Este plano copia essa forma — mesma leitura por linha, mesmo marcador `∅` — em vez de inventar uma segunda convenção visual de `NULL` dentro do mesmo `DatasetCard`: a seção "Consultar" (18-B) e a pré-visualização (este plano) ficam lado a lado no mesmo cartão, e mostrar `NULL` de dois jeitos diferentes ali seria uma inconsistência visível, não uma escolha de design. Pela régua dos três, isto é a **segunda** ocorrência de "formatar uma célula Arrow para exibição" — copia a forma, não extrai (uma eventual terceira ocorrência decidiria extrair, não é o caso hoje).

Consequência que o rascunho original não cobria: copiar `formatCell()` também resolve `bigint` de graça — uma coluna de ID grande (o caso mais comum de `BIGINT` num CSV) chega como `bigint` do JS, que não renderiza como texto sem `.toString()`. O teste do passo 2 cobre isso lado a lado com `NULL`/string vazia, não como caso separado.

### D18C.7 — Escopo de formato: só o leitor delimitado de hoje

Nenhuma mudança em `dataset:pick`/`dataset:attach` (continuam csv/tsv/txt). O `read_csv_auto` que a *view* da D18B.3 já usa detecta separador e encoding de forma mais robusta que o parser manual do plano 16 (`core/dataset/scan.ts`) — mas trocar o scanner do nível 1 por DuckDB é uma unificação fora do escopo deste plano, já registrada como gatilho de `ROADMAP` numa sessão anterior. Os dois mecanismos continuam paralelos por enquanto: `scanDelimited` decide o que o `DatasetPart` guarda no anexo; `read_csv_auto` decide o que a pré-visualização mostra. **Quando divergem, não é "confuso mas aceitável" — é um defeito visível: o mesmo cartão mostra duas contagens de coluna diferentes, as duas vindas do app.** O passo 4 testa isso com um fixture propositalmente ambíguo, em vez de deixar para descobrir depois.

**Nota de custo, para não superestimar quanto a pré-visualização economiza:** mesmo pedindo só 50 linhas, o sniffer do `read_csv_auto` amostra até ~20 mil linhas para detectar tipo — barato, mas significa que "pré-visualizar um arquivo de 2 GB" não é literalmente 50 linhas de I/O. Não muda o desenho deste plano; evita a leitura errada de que o custo é proporcional só ao que aparece na tela.

---

## Passos

| # | Entrega | Testes | Aceite |
|---|---|---|---|
| **1** | `useDatasetPreview(hash)` — hook TanStack Query (D18C.4), chama `dataset:query` com `'SELECT * FROM dataset LIMIT 50'` (D18C.2 — o teto entra no SQL, não num parâmetro novo), decodifica os bytes Arrow com `tableFromIPC`, mapeia `Result` para `ViewState<Table>` no mesmo formato de `useAiModels` | Nível 2 (jsdom, `installApiMock()`) — **o mock devolve bytes Arrow reais**, via `columnsToArrowBytes` (`core/duckdb/arrow.ts`) — o mesmo padrão que `DatasetQueryPanel.test.tsx` já usa, não um `ArrayBuffer` inventado | `loading` enquanto pendente; `error` se `Result.ok === false` ou a chamada rejeitar; `ready` com a `Table` decodificada; a chamada ao mock confere o SQL exato com `LIMIT 50` |
| **2** | `DatasetPreview` — componente que consome `useDatasetPreview` e renderiza os **quatro** estados do `ViewState` (D18C.5): `loading` → `<p role="status">`, `error` → `<p role="alert">{errorMessage(...)}</p>`, `empty`/`ready` → tabela sem virtualização (D18C.1), lendo linha por linha (`for (const row of table) { row.toArray() }`, nunca `vector.toArray()` direto — D18C.6), célula formatada copiando `formatCell()` do `DatasetQueryPanel` (∅ para `null`/`undefined`, `.toString()` para `bigint`), contida em `overflow-x: auto` | Nível 2 — **fixture com `NULL`, string vazia e `bigint` lado a lado**, não casos supostos separadamente; mock pendente confere o texto de `loading`; mock rejeitado/`Result.ok===false` confere o texto de `error` | Renderiza até 50 linhas; célula `NULL` mostra `∅`, célula de string vazia fica visivelmente em branco — **visivelmente diferentes** uma da outra; célula `bigint` renderiza como texto sem quebrar; coluna larga rola dentro do card, não estoura o layout; `loading` e `error` renderizam texto, nunca uma seção em branco |
| **3** | Aviso de truncamento a partir de `part.rowCount` (D18C.3) — "mostrando as primeiras 50 de N linhas" quando `rowCount > 50`; nenhum aviso quando o arquivo tem 50 linhas ou menos | Nível 2 | Fixture com 200 linhas mostra o aviso com o número certo; fixture com 10 linhas não mostra aviso nenhum |
| **4** | Integração no `DatasetCard` (D18C.5) — a seção nasce sempre visível, acima do botão "Consultar" do 18-B (**ordem provisória**: com só duas seções opcionais existindo hoje — Consultar do 18-B, perfil ainda não construído —, esta é a ordem óbvia; o 18-D é quem decide a ordem final das quatro seções do card, esta linha não trava nada); os quatro estados de `ViewState` renderizam algo (D18C.5 — `loading`/`error` incluídos, não só o caminho feliz); estado vazio (arquivo com 0 linhas de dado, só cabeçalho) mostra texto, não uma tabela vazia | Nível 2 + **fixture de nível 2/4 com CSV separado por `;` e um campo entre aspas contendo `,`** — confere se `part.columns.length` (chrome, de `scanDelimited`) bate com o número de colunas que a pré-visualização de fato renderiza (de `read_csv_auto`); **se divergir, é o achado a investigar nesta sessão, não um "confuso mas aceitável" a deixar passar** — os dois números aparecem na mesma mensagem, ambos vindos do app | `pnpm dev` ao vivo: anexar um CSV real com mais de 50 linhas mostra a pré-visualização sem nenhum clique, com **exatamente 50 linhas** (confirma ao vivo que o `LIMIT 50` embutido no SQL, não o teto de 201 do canal, é quem decide o que chega); **olhar o instante entre anexar e a tabela aparecer** — o texto de `loading` visível, sem o cartão saltar de altura de forma abrupta; anexar um CSV só com cabeçalho mostra o texto de vazio; o fixture ambíguo acima não mostra contagens divergentes entre chrome e pré-visualização — se mostrar, vira entrada no `HISTORY.md` antes de fechar o passo, escalado ou não |
| **5** | Fechamento: diário; `ROADMAP § 2` — nenhum gatilho novo necessário (o de unificação `scanDelimited`/DuckDB já existe, D18C.7 só reafirma) | — | `pnpm check:fast` verde; nada pendente de registro |

---

## Ordem de dependência

```
1 (hook) ──► 2 (tabela) ──► 3 (aviso de truncamento) ──► 4 (integração no card) ──► 5 (fechamento)
```

Linear — cada passo é visível e testável isoladamente antes do próximo, mas nenhum tem razão para existir fora dessa ordem.

---

## Riscos

0. ~~**Concorrência entre pré-visualizações simultâneas, sem id de correlação no protocolo do worker**~~ — **resolvido dentro do próprio 18-B, confirmado ao ler o código real, não trabalho deste plano.** `createDuckdbRunQuery` (`main/duckdb/spawnWorker.ts`) serializa toda chamada a `runQuery` numa `tail` promise — o cenário que este risco descrevia (vários `DatasetCard` disparando `dataset:query` ao montar, sem clique) não troca mais resposta entre cartões: cada pedido espera o anterior terminar antes de seguir. **Risco correlato, não fechado nem por este plano nem pelo 18-B**, registrado como armadilha no `HISTORY.md`: se o worker morrer no meio de uma fila (`memory_limit` de 2GB estourado por outra consulta em voo), toda chamada seguinte na mesma `tail` nunca recebe `'message'` nem `'exit'` (já disparado) e fica pendurada para sempre, sem erro na UI. Dono é o 18-B (é lá que `createDuckdbRunQuery` vive); este plano só torna o cenário mais alcançável na prática, ao tornar consultas simultâneas o caso comum — várias mensagens com dataset na mesma conversa — em vez do raro (duplo clique no botão Executar).
1. ~~**`scanDelimited` e `read_csv_auto` podem discordar num CSV ambíguo**~~ — **endereçado no passo 4**: fixture propositalmente ambíguo (`;` como separador, campo entre aspas com `,`) confere se as duas contagens de coluna batem, em vez de descobrir isso depois de ir ao ar. Se divergirem de verdade, vira achado de sessão (`HISTORY.md`), não surpresa de usuário.
2. ~~**`tableFromIPC`/acesso a célula do `apache-arrow` pode não distinguir `null` de string vazia**~~ — **endereçado no passo 2**: fixture com as duas condições lado a lado na mesma coluna, aceite exige renderização visivelmente diferente entre elas, não só "existe um marcador".
3. **O sniffer do `read_csv_auto` amostra até ~20 mil linhas mesmo para uma pré-visualização de 50** — custo conhecido e aceito (D18C.7), não é falha; registrado para não presumir que o custo escala só com o que aparece na tela.

---

## Verificação

- `pnpm check:fast` depois de cada passo.
- `pnpm dev` ao vivo no passo 4 — o momento em que a pré-visualização aparece de verdade numa conversa.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 19/08/2026 | 1–5 | **concluído** — plano fecha e move para `implemented/` | **Achado só na implementação, que nenhuma revisão previu:** tornar a pré-visualização automática quebrou testes que montavam o cartão sem mockar `dataset.query` — o `vi.fn()` mudo resolvia `undefined`, o hook lia isso como erro e poluía a tela com um segundo `role="alert"`. Corrigido no `test/api-mock.ts`, que passou a resolver bytes Arrow vazios por padrão, mesma razão de `ai.models` resolver um catálogo real. |
| 19/08/2026 | — | plano corrigido contra o 18-B **implementado** | **Achado maior, ao pedir só um "check rápido":** a suposição central do plano nunca foi possível como escrita — a função que ele pretendia chamar com `limit = 50` só existe **dentro** do handler do main, contra um teto fixo, e o canal nunca expôs `limit`. Minha primeira correção estendia o contrato com um `limit` opcional — chegou a virar um passo inteiro, **reabrindo um canal fechado no dia anterior**. O advisor apontou o caminho simples que ela não considerou: o embrulho impõe um teto, nunca um piso, e como o plano controla o texto do SQL, um `LIMIT 50` interno já basta. Voltou a 5 passos, com o mesmo critério de aceite ao vivo — prova de que nada se perdeu na simplificação. **A lição que sobrevive ao plano:** verificar *"o mecanismo existe?"* não é o mesmo que verificar *"é necessário?"* — a primeira correção passou na primeira pergunta e falhou na segunda. |
| 18/08/2026 | — | plano escrito | Decisão central: sem paginação nem cursor (D18C.1) — a pré-visualização é retrato único por decisão de produto, não ferramenta de navegação; quem precisa navegar usa o SQL cru do 18-B. Zero canal novo. A revisão transformou "confuso mas aceitável" (divergência entre o sniffer próprio e o do motor) em **teste bloqueante**, e tirou a detecção de `NULL` da lista de riscos para virar fixture. |

**O que este plano deixou fora dele:**

| Achado | Dono |
|---|---|
| Correção pós-18-C: sem duplicidade no `DatasetCard`, fallback de encoding no CSV | [`HISTORY.md`](../../HISTORY.md) |
| `latin-1` não é fallback infalível — byte que quebra os dois | [`ARMADILHAS.md`](../../ARMADILHAS.md) |
| Decisões D18C.1–D18C.7 | [`DECISOES.md`](../../DECISOES.md) |