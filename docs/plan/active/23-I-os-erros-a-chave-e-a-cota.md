# 23-I — os dez erros, a chave e a cota

> Nono corte do arco 23. Material de entrada: [`docs/reference/context7/`](../../reference/context7/README.md) lido na íntegra (os quatro arquivos) e os **oito** diários dos cortes implementados. Siglas nascem como `D23I.n`.

## Contexto

Oito cortes entregaram o caminho feliz inteiro: o cliente REST (23-A), a fronteira (23-B), a parte persistida (23-C), o painel (23-D), a desambiguação (23-E), o resultado (23-F), a seleção com `Anexar` (23-G) e a conversa (23-H). **O que falta é tudo o que acontece quando a consulta não dá certo — e o que o usuário precisa saber antes de tentar.**

Hoje, lendo o código:

- `DocsCandidates.tsx:128` renderiza **a palavra crua do status** (`empty`, `indexing`, `library-not-found`) numa tag `<p>`, com o comentário `o português de cada é 23-I's`;
- `DocsPanel.tsx:97` renderiza o `message` do `no-libraries` **como o Context7 o escreveu — em inglês** (*"No libraries found for …"*);
- falha de rede cai no `StateView` genérico, que chama `errorMessage()`: um `timeout` vira *"A operação demorou demais e foi interrompida."*, sem dizer que são 30 s nem que o serviço é o Context7 — o que **descumpre a condição 1 de D23B.1**, que fez parte da recomendação de não usar job;
- a consulta roda **em modo anônimo em silêncio** quando não há chave: `getApiKey()` devolve `null`, o cliente omite o header e ninguém na tela sabe que há uma cota correndo;
- o header de cota chega em **toda** resposta e é **descartado** — o cliente só o lê dentro do texto do 429.

Este corte fecha as quatro decisões que o dono tomou em 12/09/2026 ([`README.md § O que falta DECIDIR`](../../reference/context7/README.md)), e o eixo delas é um só: **a primeira tela vira o lugar de administração da consulta**, e nenhuma situação de falha chega ao usuário como palavra de máquina.

Entregas, na ordem em que serão construídas:

1. **os dez textos de erro**, cada um com a sua ação — mais o 11º, o teto de 30 s, que a DM-12 não previa;
2. **a exigência de chave**, revogando a metade "opcional" de DM-19;
3. **a cota restante e o estado da chave** na primeira tela, com o canal e o *seam* que isso pede;
4. **`Ver de novo` e `Consultar de novo`** como dois botões no rodapé do Estado 3.

⚠️ **Corte único por decisão do dono** (12/09/2026), ciente de que o guia autoriza dois irmãos e de que a alternativa oferecida era `23-I` + `23-M`. A ressalva do plano 19 vale e está assumida: os **cinco passos são commitáveis em separado**, e o passo 5 é fase, não opcional.

---

## O que já está pronto e não se reconstrói

Levantado lendo o código em 12/09/2026, não suposto.

| Peça | Estado | Consequência para este corte |
|---|---|---|
| Situação 1 (campo vazio) | ✅ **feita no 23-D** — `DocsCompose.tsx:24` desabilita `Consultar` | nada a escrever; o portão da chave **soma** a esta regra, não a substitui |
| Situações 5 e 6 (429 com e sem chave) | ✅ **feitas no 23-A** — `quotaMessage()` compõe os dois textos opostos, com `Ratelimit-Reset` formatado em hora local | o renderer **usa** `error.message`, nunca reescreve |
| `library-not-found` (a décima) | tipo e classificação prontos (`client.ts:72`) | falta só o texto e a ação |
| `mapDocsError` (`handlers.ts:74`) | já separa `upstream` · `timeout` · `unavailable`, com `service: 'context7'` | **a classificação está completa** — o corte não toca o main nesta parte |
| `useCloudSecret('context7')` | **compila hoje**, porque `context7` entrou em `CLOUD_PROVIDERS` no 23-B (D23B.4) | a exigência de chave não precisa de canal, schema nem main |
| Campo da chave em Configurações | ✅ 23-B, ao lado de Gemini e GLM | a frase do painel **aponta** para lá, não abre nada |
| `createDocsCache` (`cache.ts`) | memo de sessão, só `found`/`ready` entram (D23B.10) | é o que torna `Ver de novo` gratuito e `Consultar de novo` necessário |
| `Ratelimit-*` nos headers | chegam em toda resposta; `client.ts:114` só os lê no 429 | falta **propagá-los**, não medi-los |
| `Button`, `Field`, `StateView`, `SidePanel` | primitivos | **nenhum design system nasce aqui** |

### O que a pesquisa externa acrescentou (obrigatória, feita em 12/09/2026)

- **Os nomes dos headers estão documentados**: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` e `Retry-After` no 429 ([API Guide](https://context7.com/docs/api-guide)). O cliente já os lê em minúsculas, e `Headers.get` é insensível a caixa — nada a corrigir.
- **O formato da chave é `ctx7sk-…`** ([howto/api-keys](https://context7.com/docs/howto/api-keys)); o `ctx7op-` é de conta *enterprise*. Serve de *placeholder* no campo, não de validação.
- ⚠️ **Não existe endpoint de cota.** Nenhuma rota devolve o consumo sem gastar uma chamada — o painel do site é o único outro lugar. **É isto que torna a implicação da decisão 1 inevitável:** o número só pode vir do header da última resposta, e antes da primeira consulta da sessão não há número.
- ⚠️ **Achado que reforça a exigência de chave, e é novo:** o regime anônimo é descrito como **um pool global compartilhado** (*"unauthenticated requests share a global anonymous rate limit pool"*, [DeepWiki sobre `upstash/context7`](https://deepwiki.com/upstash/context7/18.1-authentication-and-api-keys)). Se for verdade, a cota anônima **não é sua** — ela esgota pelo tráfego de terceiros, o que é um modo de falha ainda pior que o silêncio que DM-19 revogada já condenava. ⚠️ **Procedência fraca — fonte secundária, nunca sondada.** Entra no plano como argumento de apoio e como a segunda coisa que a sonda do passo 3 observa; **não** entra em documento nenhum como fato.

---

## Decisões a fixar

**D23I.1 — o mapeamento de falha é uma função pura no renderer, nunca `messages.ts`.** Nasce `features/docs/docsFailure.ts`, que recebe o `ViewState` (ou o `AppError`) e devolve `{ text, action }`. É DM-12 sendo cumprida ao pé da letra: `shared/ui/messages.ts` é dono da tradução de `AppError['kind']` para o app inteiro, e nove textos específicos de um painel ali **apagariam** a distinção — um `upstream` do Context7 e um do Ollama são o mesmo `kind`. Estado de tela mora onde `ArtifactDataset` guarda o seu *"Arquivo sem linhas de dado."*

**D23I.2 — o `StateView` não ganha `renderError`.** A tentação é acrescentar um *slot* de erro ao primitivo. Recusada pela régua do envelope: o painel trata `state.status === 'error'` **antes** de chamar `StateView`, num componente local (`DocsFailure.tsx`). Um segundo chamador fará o primitivo crescer; um só, não.

**D23I.3 — 401/403 ganha texto próprio no renderer, e o 429 não.** `AppError.upstream` carrega `status`, então `docsFailure` decide por ele: **429 usa `error.message` intacto** (o cliente já compôs os dois textos opostos com a data real — reescrever aqui criaria um segundo dono), **401/403 recebe o texto deste corte** (`describeUpstreamError` é provider-agnóstico e foi escrito para provedor de IA), **o resto usa `error.message`**. Nenhuma linha no main.

**D23I.4 — as situações 5 e 7 não abrem Configurações: nomeiam.** DM-12 escreveu *"abre Configurações"* como ação, e isso **não é barato**: `Settings` é autocontido (botão + diálogo próprios, duas instâncias no `App.tsx:59` e `:95`), então um comando global exigiria erguer estado para a casca — peça de chrome nascendo dentro de um corte de feature. O precedente real do repositório é `useCloudCatalog`, que para Gemini e GLM usa **a frase que diz onde configurar**, com o portão no clique e nunca na visibilidade. **A DM-12 é corrigida no plano, com o motivo** — decisão do dono, 12/09/2026.

**D23I.5 — o portão da chave fica no `Consultar`, e o item `Documentação` do menu `+` continua nunca travando.** É a distinção que D23D.3 obriga a escrever, porque quem ler as duas em sequência vai achar que se contradizem: **lá** o motivo é disputa de *slot* com anexo pendente (os três itens de arquivo travam, este não); **aqui** é pré-requisito. Fechar o menu esconderia justamente a tela onde se diz o que fazer. O portão vale nos **dois** `Consultar` — tela 1 e tela 2 —, porque a chave pode ser removida no meio de uma composição.

**D23I.6 — a cota e a chave só existem na tela 1.** *"Tem espaço de sobra nesse painel e é o único lugar onde faz sentido"* — informação de administração não segue a pessoa pelo processo. Nada disso aparece nas telas 2, 3 nem na releitura do 23-H.

**D23I.7 — sem número é `sem consulta nesta sessão`, nunca zero.** `Ratelimit-Remaining` chega no header da **resposta**, e não existe endpoint de cota (verificado contra a fonte). Na primeira consulta depois de abrir o app não há número, e mostrar `0` seria mentir na direção que assusta. O memo é de **sessão**, como o de respostas (D23B.10): reiniciar o app zera o que se sabe, e isso é honesto.

**D23I.8 — o número exibido é sempre o do header, nunca a constante documentada.** O 23-A mediu `Ratelimit-Limit: 200` no anônimo; a documentação fala em 1.000/mês com chave e 60/hora no anônimo — três números de três fontes. **O painel repete o que o serviço disse na última resposta**, e por isso o rótulo cita `Context7` como fonte em vez de afirmar o plano do usuário.

**D23I.9 — a cota viaja por um *seam* injetado, não dentro do `Outcome`.** `Context7Deps` ganha `onQuota?`, chamado em `request()` para toda resposta — mesma forma de decisão de `fetchFn` (D23A.1, D9.2). Pôr a cota dentro de `SearchOutcome`/`ContextOutcome` os transformaria de *estado de tela* em envelope de metadado, e **não funcionaria no caso que mais importa**: um 429 lança, então nenhum `Outcome` volta justamente quando o número é mais interessante.

**D23I.10 — `docs:quota` não devolve `Result`.** É leitura de um memo em memória do próprio processo, sem modo de falha que a interface distinga — mesma régua de `dataset:queueDepth` (O-2) e `database:info` (DO3.3). Embrulhar tudo treina o leitor a ignorar o `ok`.

**D23I.11 — `Ver de novo` e `Consultar de novo` são os dois botões, e a diferença é uma palavra no payload.** `docs:fetch` ganha `refresh?: boolean`. `Ver de novo` chama sem ele: bate no memo, **não gasta cota**, devolve a resposta já paga e — o efeito útil — **descarta a marcação manual**, voltando à resposta como ela chegou. `Consultar de novo` manda `refresh: true`, pula a leitura do memo, **gasta uma chamada** e regrava o memo com trechos novos. A forquilha *"botão que mente ou botão que cobra"* se dissolve porque ambos existem, rotulados pelo que fazem. Os dois **somem depois de `Anexar`**, junto de `Voltar` e `Anexar`, pela mesma razão de D23G.7: a consulta está congelada.

**D23I.12 — o `202` não se caça.** Custa cota sem garantia de encontrar, e a classificação do cliente é um ramo por código HTTP: `client.test.ts:140` já o exercita com resposta montada à mão. O que este corte acrescenta é o **texto**, não uma sonda.

**D23I.13 — a soma dos dois regimes de cota, se existir, nunca é automática.** A sonda de 2 chamadas do passo 3 responde se anônimo e com-chave são contadores separados. ⚠️ **Independente do resultado, o app não cai para o anônimo quando a chave esgota:** isso reintroduziria exatamente o silêncio que motivou exigir a chave. Se um dia os 200 forem aproveitados, que seja recuo **anunciado**.

---

## Os onze textos

A tabela da DM-12 tinha nove; o 23-A achou a décima (`library-not-found`); a condição 1 de D23B.1 obriga a décima primeira (o teto de 30 s). **Cada texto nomeia a causa e o conserto** — é o princípio inteiro da decisão.

| # | Situação | Como chega | Texto | Ação |
|---|---|---|---|---|
| 1 | campo vazio | — | — | ✅ `Consultar` desabilitado (23-D) |
| 2 | nome sem correspondência | `no-libraries` no valor | *"Nenhuma biblioteca com esse nome. Tente outro termo — o Context7 indexa pelo nome do repositório ou do site."* | volta ao campo, **texto preservado** |
| 3 | pergunta sem resposta | `empty` no valor | *"A biblioteca existe, mas nada respondeu a essa pergunta. Tente reformular."* | `Tentar de novo` (gasta — `empty` nunca entra no memo) |
| 4 | biblioteca em indexação | `indexing` no valor | *"Esta biblioteca ainda está sendo indexada pelo Context7. Tente daqui a alguns minutos."* | `Tentar de novo` · escolher outro candidato |
| 10 | biblioteca sumiu entre as duas chamadas | `library-not-found` no valor | *"Esta biblioteca não está mais no Context7. Volte e escolha outra."* | `Voltar` |
| 5 | cota estourada, **sem** chave | `upstream` 429 | ✅ do cliente, intacto (D23I.3) | frase: onde configurar |
| 6 | cota estourada, **com** chave | `upstream` 429 | ✅ do cliente, intacto | — (só esperar) |
| 7 | chave recusada | `upstream` 401/403 | *"A chave do Context7 foi recusada. Confira a chave em Configurações."* | frase (D23I.4) |
| 8 | serviço com problema | `upstream` 5xx | `error.message` (`describeUpstreamError`) | `Tentar de novo` |
| 9 | sem alcançar o serviço | `unavailable` | o `UNAVAILABLE_HINT` que já existe | `Tentar de novo` |
| **11** | **não respondeu em 30 s** | `timeout`, `afterMs` | *"O Context7 não respondeu em 30 segundos e a consulta foi interrompida. Se o serviço estiver lento, tentar de novo costuma resolver."* | `Tentar de novo` |

⚠️ **A 11 é a que fecha uma dívida do 23-B, não um capricho.** A recomendação de `invoke` simples em vez de job veio com três condições, e a primeira é *"o teto de 30 s aparece na tela, nunca em silêncio"*. Ela está **descumprida desde o 23-B** e ninguém notou, porque o teto nunca foi atingido.

⚠️ **Nenhum botão `cancelar` nasce aqui** (condição 2 da mesma decisão): sem um `JobId` que endereçe o `AbortController`, ele pararia de ouvir e deixaria a requisição correndo — mentira cara, porque a cota some do mesmo jeito.

---

## Os passos

### Passo 1 — os onze textos e as ações

Chamador e chamado na mesma leva — a lição medida no 23-G, passo 1, e repetida no 23-H.

- `features/docs/docsFailure.ts` — **novo**, função pura. Recebe o `ViewState<SearchOutcome>` ou `ViewState<ContextOutcome>` e devolve `{ text, action: 'retry' | 'back' | 'settings-hint' | 'none' }`. Despacha por `status` do valor e, no ramo `error`, por `kind` e depois por `status` (D23I.3).
- `features/docs/DocsFailure.tsx` — **novo**. Renderiza o texto e o botão da ação; nada além disso. É o que substitui o `StateView` genérico no ramo de erro (D23I.2).
- `DocsPanel.tsx:92-101` — o `result` da tela 1 passa a usar `DocsFailure`; o `message` cru em inglês **sai**.
- `DocsCandidates.tsx:121-131` — o `<p>{outcome.status}</p>` **sai**; entra `DocsFailure`, e o rodapé ganha `Tentar de novo` conforme a ação.

⚠️ **O `message` do `no-libraries` continua chegando do serviço e continua sendo descartado na tela.** Não traduzir, não exibir: é texto de terceiro em inglês, e o texto 2 responde melhor.

**Vermelho a provar:** o `empty` e o `indexing` produzindo o mesmo texto (prova que o despacho é por `status`, não um genérico); e o 429 sendo reescrito pelo renderer em vez de usar `error.message` do cliente.

### Passo 2 — a exigência de chave

- `DocsCompose.tsx` — `useCloudSecret('context7')`; `ready` passa a exigir `hasKey`. Uma linha breve sob os campos dizendo o estado: `chave configurada` ou `sem chave — configure o Context7 em Configurações`.
- `DocsCandidates.tsx` — o mesmo portão no `Consultar` da tela 2 (D23I.5).

⚠️ **`loaded` antes de decidir.** A régua do design system vale aqui em espírito: enquanto `useCloudSecret` não carregou, o botão não deve piscar de habilitado para desabilitado. `loaded && hasKey` é a condição.

⚠️ **Não mexer no `AttachMenu`.** O item `Documentação` continua nunca travando (D23D.3, D23I.5).

**Vermelho a provar:** `Consultar` habilitado com os dois campos preenchidos e **sem** chave; e o item `Documentação` travando junto dos três de arquivo.

### Passo 3 — a cota chega à tela 1

O passo que atravessa as camadas. **Seis lugares, na ordem que a skill `ipc` fixa** (+ os dois que não são canal).

- `shared/ipc.ts` — tipo `DocsQuota = { limit: number | null; remaining: number | null; resetAt: number | null }`; `argsSchema['docs:quota'] = z.void()`; `IpcContract` com `result: DocsQuota | null` (**sem `Result`** — D23I.10); `Api.docs.quota()`.
- `core/context7/client.ts` — `Context7Deps.onQuota?`, chamado em `request()` para **toda** resposta (D23I.9). Lê os três headers, `null` quando ausente ou não numérico — o mesmo cuidado que `resetDate()` já toma.
- `main/features/context7/quota.ts` — **novo**, ~15 linhas: `createQuotaMemo()` → `{ record, read }`. Memo de sessão, irmão de `cache.ts`.
- `main/features/context7/handlers.ts` — `readDocsQuota(_, deps)`; `clientDeps()` passa o `onQuota`.
- `main/ipc/register-all.ts` — `quota: createQuotaMemo()` em `docsDeps`; `handle('docs:quota', …)`.
- `preload/api.ts` — `quota: () => invoke('docs:quota', undefined)`. ⚠️ **96 linhas hoje** — ver a régua abaixo.
- `test/api-mock.ts` — o `satisfies Api` cobra sozinho.
- `features/docs/useDocsQuota.ts` — **novo**. `useQuery` em `['docs','quota']`, invalidado depois de cada `search`/`fetch` no `DocsProvider`.
- `DocsCompose.tsx` — a linha da cota, ao lado da linha da chave: `146 de 200 consultas restantes · Context7`, ou `sem consulta nesta sessão` (D23I.7, D23I.8).

**A sonda de 2 chamadas, que é do dono** (`api.md § O que ainda não foi verificado`): uma chamada **com** chave e uma **sem**, lendo `Ratelimit-Limit`/`Ratelimit-Remaining` nos dois headers, para responder se anônimo e com-chave são contadores separados. ⚠️ **Duas chamadas, não mais** — a cota é uma só e sondar gasta o que usar gastaria. Observar de passagem se o limite anônimo se comporta como pool compartilhado (o achado da pesquisa, procedência fraca). O resultado vai para o `api.md`; **a conduta não muda** (D23I.13).

**Vermelho a provar:** o memo devolvendo número depois de um 429 (prova que `onQuota` roda **antes** do `throw`, que é o caso em que a cota mais importa); e a tela mostrando `0 de 200` em vez de `sem consulta nesta sessão` quando o memo está vazio.

### Passo 4 — `Ver de novo` e `Consultar de novo`

- `shared/ipc.ts` — `docs:fetch` ganha `refresh: z.boolean().optional()`; `Api.docs.fetch` acompanha.
- `main/features/context7/handlers.ts` — `if (args.refresh !== true)` antes de ler o memo; a **escrita** continua igual. A chave do memo **não** inclui `refresh`.
- `preload/api.ts` · `useDocsFetch.ts` · `DocsProvider.fetchDocs` — o booleano atravessa.
- `DocsResult.tsx:114-145` — os dois botões no rodapé, à esquerda de `Voltar`/`Anexar`, e **os quatro somem** quando `frozen`.

```
│ 3 de 5 · ~588 tok · cabe (janela 32.768, 71% livre)          │
│   [ Ver de novo ] [ Consultar de novo ]  [ Voltar ] [ Anexar ]│
```

⚠️ **O rótulo é o contrato.** `Ver de novo` não pode gastar cota e `Consultar de novo` não pode deixar de gastar — é literalmente a forquilha que a decisão 3 do dono dissolveu.

**Vermelho a provar:** `Ver de novo` mandando `refresh: true`; e `Consultar de novo` sendo servido pelo memo.

### Passo 5 — verificação ao vivo e fechamento

Fase, não opcional. Roteiro numerado, conferido pelo dono na tela.

| # | O que fazer | O que tem de acontecer |
|---|---|---|
| 1 | Abrir o painel **sem** chave configurada (remover em Configurações) | A tela 1 diz `sem chave — configure o Context7 em Configurações`, e `Consultar` fica desabilitado **mesmo com os dois campos preenchidos** |
| 2 | Abrir o menu `+` do composer sem chave | O item `Documentação` **continua alcançável** e abre o painel — é D23D.3 × D23I.5 na tela |
| 3 | Gravar a chave e reabrir o painel | A linha vira `chave configurada`; `Consultar` habilita |
| 4 | Olhar a linha da cota **antes** de qualquer consulta | `sem consulta nesta sessão` — **nunca `0`** |
| 5 | Consultar uma biblioteca de verdade | A linha da cota passa a mostrar `N de M · Context7`, com o número vindo do header |
| 6 | Digitar um termo sem sentido (`xqzvwrt`) e consultar | Texto 2 em português, **nenhuma palavra em inglês na tela**, e o que foi digitado continua no campo |
| 7 | Escolher um candidato e perguntar algo absurdo para a biblioteca | Texto 3, com `Tentar de novo` — e apertar o botão **gasta** (a cota cai) |
| 8 | Chegar ao Estado 3 e apertar `Ver de novo` | Volta a mesma resposta, **a cota não cai**, e a marcação manual volta ao estado inicial |
| 9 | Apertar `Consultar de novo` | A cota **cai**, e a resposta pode vir diferente |
| 10 | `Anexar` | Os **quatro** botões somem — `Ver de novo`, `Consultar de novo`, `Voltar`, `Anexar` |
| 11 | Trocar a chave por uma inválida e consultar | Texto 7 (chave recusada), com a frase apontando Configurações — **e nenhum botão que abra Configurações** |
| 12 | Desligar a rede e consultar | Texto 9, com `Tentar de novo` |
| 13 | A sonda dos dois regimes (2 chamadas) | Registrar `Ratelimit-Limit`/`Remaining` com e sem chave no `api.md` |

⚠️ **A situação 4 (`202`/indexing) e a 10 (`library-not-found`) não se caçam ao vivo** (D23I.12) — ficam provadas por teste com resposta montada à mão, e o roteiro não as pede.

Fechamento: `check:fast` remedido · errata devolvida aos quatro documentos do guia (incluindo DM-12 virando **onze** e DM-19 com a metade "opcional" cumprida) · a linha do `ROADMAP § 3` sobre a exigência de chave **removida**, porque deixa de ser pendência · conferência das sete skills · a régua das quatro derivas do [`CLAUDE.md`](../../../CLAUDE.md).

---

## Régua de tamanho a vigiar

| Arquivo | Hoje | Teto | Risco |
|---|---|---|---|
| `src/preload/api.ts` | **96** | 100 (espírito da regra de `index.ts`) | +2 linhas no passo 3 → ~98. **Se passar de 100, divide por domínio**, como o 23-C fez com o `index.ts` |
| `DocsCompose.tsx` | 73 | 400 | cresce com duas linhas de administração e o portão — folgado |
| `DocsCandidates.tsx` | 155 | 400 | cresce com `DocsFailure` e o portão |
| `DocsResult.tsx` | 151 | 400 | +2 botões — folgado |
| `DocsProvider.tsx` | 263 | 400 | cresce com o `refresh` e a invalidação da cota. **Coesão pesa antes do teto** |
| `main/features/context7/handlers.ts` | 85 | 150 | +handler de cota e o ramo de `refresh` |

---

## Fora do escopo

A caixa `consulta ampla` (`fast=true`) e o `+` do cabeçalho — **23-L**, e a primeira é deliberada: DM-18 deixou de ser absoluta, mas é opção de composição, não modo de falha, e enfiá-la aqui repetiria o erro que a divisão do 23-K acabou de desfazer · o livro-razão e a pergunta enviada ao Context7 no Observatório — **23-K** · a variante inline do `MarkdownMessage` para o título do trecho e os três `aria-expanded` — **23-L** · `ESCOPO.md`, o peso da linha de privacidade, o guia antigo `⛔ consumido` e a passada final ao vivo — **23-J** · qualquer botão de cancelamento ou promoção do `invoke` a job (o gatilho medido não disparou) · E2E do painel (criaria o terceiro spec de nível 4 que apodrece fora do `check:fast` — e o 23-C achou um apodrecido desde 27/08).

---

## Como se verifica

| Peça | Nível | Forma |
|---|---|---|
| `docsFailure` — os onze ramos | 2 | função pura, sem montar componente; um caso por situação |
| `onQuota` chamado em toda resposta, **inclusive no 429** | 1 | `client.test.ts`, com as fixtures já gravadas + resposta montada à mão |
| memo de cota, e o `refresh` pulando o memo | 3 | handler exportado, dependências por parâmetro, sem Electron |
| portão da chave, os dois botões, as telas de falha | 2 | jsdom; a classe é afirmável, a cor e o layout não |
| a cota real, o 401 real, a rede caída | ao vivo | só o olho — e a sonda de 2 chamadas |

⚠️ **A suíte nunca bate na API.** As fixtures de `src/core/context7/__fixtures__/` foram gravadas uma vez; um teste que chame o serviço queima a cota do mês em poucas corridas.

⚠️ **Antes de mandar uma asserção para "só ao vivo", verifique se ela cabe sobre a classe** — o veredito já saiu errado por metade uma vez neste projeto.

---

## Diário de execução

| Data | O que mudou | Observações |
|---|---|---|
| 12/09/2026 | Plano escrito a partir do guia do arco 23 (os quatro arquivos, na íntegra) e dos **oito** diários; D23I.1–D23I.13 fixadas | Três forquilhas resolvidas pelo dono: **corte único** (recusada a divisão em 23-I + 23-M), os dois botões no rodapé do Estado 3, e a ação das situações 5/7 como **frase** e não como botão que abre Configurações. **Quatro achados contra o guia e contra o próprio código:** (1) a condição 1 de D23B.1 — o teto de 30 s na tela — está **descumprida desde o 23-B**, o que faz os nove textos da DM-12 virarem **onze**; (2) não existe endpoint de cota no Context7 (verificado contra a fonte), então o número só pode vir do header e `sem consulta nesta sessão` é inevitável; (3) `Settings` é autocontido em duas instâncias do `App.tsx`, então *"abre Configurações"* da DM-12 não é barato; (4) pesquisa externa trouxe o regime anônimo como **pool global compartilhado** — procedência fraca (DeepWiki), registrado como argumento de apoio e **não** como fato |
| 12/09/2026 | Passos 1–4 implementados e commitados em separado; falta só a verificação ao vivo (passo 5), que é do dono | **Uma armadilha nova, e cara: `DocsFailure.tsx` ao lado de `docsFailure.ts` colidiu no Windows** — o import do componente resolveu para o módulo puro e 51 testes caíram de uma vez com `Element type is invalid`, incluindo arquivos que não tocam o componente. `typecheck` e `lint` concordam com o import; nada avisa. Componente renomeado para `DocsNotice.tsx`, entrada escalada para o [`ARMADILHAS.md`](../../ARMADILHAS.md) (114 → 115). **Três refinamentos contra o próprio plano:** (1) `DocsAction` perdeu o valor `settings-hint` — a "frase que nomeia Configurações" **é** o texto, então um estado de ação que não renderiza controle nenhum era estado morto (D23I.4 fica cumprida pelo texto); (2) o componente é `role="status"`, nunca `role="alert"`, porque tudo que ele desenha responde a um botão que a pessoa acabou de apertar — e isso **preserva** a asserção do 23-D de que um *miss* não é falha, em vez de quebrá-la; (3) a ação não vira um segundo botão: o rodapé **já é** a linha de ações, então `retry` troca o rótulo do primário para `Tentar de novo` e `back` o **remove** — uma biblioteca que sumiu não tem o que consultar. **Harness:** `secrets.has` é `false` por padrão no mock, então os três arquivos que consultam passaram a conceder a chave explicitamente — é o portão novo, não defeito. Vermelhos provados um a um, cada um com o nome do teste na lista de falhas: os dois textos iguais, o 429 reescrito, o portão removido, a cota virando zero, e os dois rótulos trocados entre si. `check:fast` remedido: **157 arquivos / 1556 testes, 158 s** (era 156/1524 no fecho do 23-H). Canais recontados no `IpcContract`: **54**, e a skill `ipc` atualizada |
