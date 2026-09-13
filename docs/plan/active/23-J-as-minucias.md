# 23-J — as minúcias

> Décimo corte do arco 23, penúltimo. Material de entrada: [`docs/reference/context7/`](../../reference/context7/README.md) (os quatro arquivos, lidos na íntegra) e os **nove** diários dos cortes implementados. Siglas nascem como `D23J.n`.

## Contexto

Nove cortes entregaram o Context7 inteiro: cliente REST, fronteira, parte persistida, painel, desambiguação, resultado, seleção com orçamento, a conversa e os onze erros. **O caminho feliz está completo e verificado ao vivo corte a corte.** O que sobrou não é feature nova — é o que se acumulou nas bordas, e cada item tem procedência registrada em vez de ser lembrança:

1. **O título do trecho é markdown e sai cru** — achado na verificação ao vivo do 23-G, na primeira linha da primeira consulta real (`` Optimistic Cache Update with Rollback using `onMutate` `` com os acentos à vista). É a mesma classe que o 23-F consertou para a descrição e para a nota; o título passou porque nenhuma consulta daquele corte trouxe código no campo. Dono do registro: [`ROADMAP § 4`](../../ROADMAP.md).
2. **A caixa `consulta ampla` (`fast=true`)** — levantada pelo dono ao usar (*"5 trechos podem não ser suficientes"*) e decidida em 12/09/2026. DM-18 deixa de ser absoluta: medido no 23-A, a mesma pergunta devolve **3 trechos / 383 tok** com `fast=false` e **25 / 3.497 tok** com `fast=true`, **pela mesma chamada de cota**.
3. **O veredito sobre o `+` do cabeçalho do painel** — forquilha 8 do guia, aberta desde o fechamento do 23-H.
4. **Os três `aria-expanded`** — forquilha 10, dívida de precisão semântica achada por pesquisa externa no 23-H.

Decisões do dono que já entram fechadas nesta sessão de planejamento:

| # | Decidido |
|---|---|
| 8 | o `+` **não existe** — o item `Documentação` do popover já inicia uma consulta, e o `histórico` já resolve a navegação |
| 9 | a variante inline nasce **aqui**, com a exceção à régua do envelope **escrita** |
| 10 | os `aria-expanded` **ficam adiados** — não entram neste corte |
| 13 | a caixa `consulta ampla` entra; o *quê* está fechado, o *como* é deste plano |

⚠️ **Este corte é de três naturezas e é por isso que ele existe separado** — o guia dividiu minúcias e livro-razão em 12/09/2026 exatamente porque instrumentação, design system e chrome num arquivo só é o erro do plano 19. Aqui sobraram **duas**: design system (a variante inline) e composição da consulta (a caixa). Os quatro passos são commitáveis em separado.

---

## O que já está pronto e não se reconstrói

Levantado lendo o código, não suposto.

| Peça | Estado | Consequência |
|---|---|---|
| `MarkdownMessage` | primitivo, CSS Modules por limite físico, dono do markdown do app (D11.2, 23-F) | ganha **uma prop**, não um segundo dono |
| `disallowedElements` + `unwrapDisallowed` | **API documentada do `react-markdown`** (confirmado via Context7 nesta sessão) | `<p>` cai e os filhos ficam — nenhum plugin novo, nenhum parser |
| `docs:fetch` | já leva `libraryId`, `query`, `version?`, `refresh?` | a amplitude é **um campo opcional**, não um canal novo (segue **54**) |
| `fetchLibraryContext` | monta `fast: 'false'` literal em `client.ts:72` | um parâmetro, um ternário |
| `DocsCache` (`main/features/context7/cache.ts`) | memo de sessão por chave composta | ⚠️ **a chave tem de crescer** — ver D23J.4, o achado mais afiado deste plano |
| `useDocsSelection` | guarda o conjunto **de fora** (D23G.3) | `marcar/desmarcar todos` são duas operações sobre esse conjunto, sem inverter o invariante |
| `DocsSnippetList` | `overflow-y-auto`, primeiro item aberto (D23F.9), `frozen` | 25 itens não pedem estrutura nova |
| `budgetFor` / `Budget` | o `Composer` é dono único (D23G.1), rodapé já diz `não cabe` | **o caminho amplo é o primeiro caso real do `não cabe`** — já construído, nunca exercitado ao vivo |
| `Switch`, `Field`, `Button`, `Tabs`, `SidePanel` | primitivos | nada de casca nasce aqui |

---

## Decisões a fixar

**D23J.1 — o `+` do cabeçalho do painel não existe, e o veredito se escreve.** Forquilha 8 fechada. O item `Documentação` do popover de anexos já inicia uma composição e o `histórico ▾` já responde *"onde estou"*; um `+` ali seria um terceiro caminho para o mesmo destino, e `painel.md` já registra que ele *"ou não faz nada, ou descarta em silêncio o que está digitado"* quando se está compondo. **Zero linha de código** — o entregável é a errata que impede a pergunta de voltar.

**D23J.2 — `MarkdownMessage` ganha `inline`, e a exceção à régua do envelope fica escrita.** A régua diz que design system não nasce dentro de um corte de feature; a exceção vale por três razões nomeadas: é **variante de um primitivo que já existe** (não linguagem visual nova), o único consumidor conhecido é deste arco, e o conserto alternativo — um partidor de acento grave — é exatamente o que a skill [`design-system`](../../../.claude/skills/design-system/SKILL.md) manda recusar, por criar um segundo dono do markdown.

Forma: `inline` renderiza um `<span className={styles.inline}>` com `disallowedElements={['p']}` e `unwrapDisallowed`, **herdando o tamanho de quem chama** — `.inline` não declara `font-size`, que é a causa raiz de o primitivo não caber num `<button>` que trunca (ele fixa 18px na própria folha).

**D23J.3 — a amplitude se chama `broad` no app e `fast` só no fio.** O vocabulário do vendor é invertido (`fast=true` quer dizer *mais trechos, sem reranqueamento*), e propagar essa inversão por três camadas é convidar o próximo leitor a ler "rápido" onde se quis dizer "amplo". O ternário `broad ? 'true' : 'false'` mora em `client.ts`, no único lugar que já conhece o formato do fio — mesmo lugar onde `version` vira sufixo de `libraryId`.

**D23J.4 — ⚠️ a chave do memo de sessão passa a incluir a amplitude, e sem isso o caminho amplo mente.** Hoje a chave é `fetch|libraryId|version|query` (`handlers.ts:53`). Ligar a caixa e consultar a mesma biblioteca com a mesma pergunta devolveria **a resposta estreita já memoizada**, de graça, com 3 trechos — e a pessoa concluiria que `fast=true` não faz nada. Não é falha de rede nem erro de tela: é **sucesso silencioso**, a classe que o projeto trata como a mais perigosa (`num_ctx` do Ollama, skill [`ai`](../../../.claude/skills/ai/SKILL.md)). A chave passa a ser `fetch|libraryId|version|broad|query`, e as duas amplitudes viram duas entradas — o que é correto: são duas respostas diferentes, cada uma paga uma vez.

**D23J.5 — `broad` mora na composição e volta a `false` quando a composição zera.** É campo de `DocsComposition`, ao lado de `version`, pelo mesmo motivo: é escolha da consulta, não preferência da máquina (não vai para `AppSettings`) e não é estado de tela. *"Desligada por padrão"* é **por consulta**, não por sessão: `clearPending` já limpa `library`/`question`/`candidateKey`/`version` depois do envio, e `broad` entra nessa lista. Uma pessoa que consulta amplo uma vez não pediu que toda consulta seguinte custe 3.497 tokens em silêncio.

**D23J.6 — a caixa fica em linha própria sob o campo Pergunta, e não dentro do `DocsAdmin`.** A errata de DM-18 escreveu *"ao lado da cota e do estado da chave"*, e a execução divirge com motivo: `DocsAdmin` é **administração** (o que a conta tem) e devolve `null` enquanto `!loaded`, então a caixa apareceria com atraso e em `text-xs text-faint` — alvo de clique ruim para o único controle da tela. A caixa altera a **requisição**, como o seletor de versão; fica onde age. `DocsAdmin` segue sem `useDocs`.

**D23J.7 — `<input type="checkbox">`, nunca `Switch`.** A APG reserva o interruptor para o que **age na hora**; esta escolha só tem efeito quando `Consultar` é apertado — é seleção pendente de submissão, que é a definição de caixa de marcação. Mesmo raciocínio de DF3F.8 na lista de trechos, e é o que a própria DM-18 escreveu ao chamá-la de *caixa*. O rótulo carrega o custo em vez de esconder: **a caixa diz o que ela faz ao orçamento**, que é o princípio de produto do [`ESCOPO`](../../ESCOPO.md) — o app nunca deixa o modelo decidir em silêncio o que descartar, e nunca deixa o usuário gastar contexto sem saber.

**D23J.8 — `marcar todos` / `desmarcar todos` nascem aqui, e isto reabre D23G.5 só onde a premissa dela caiu.** Aquela decisão recusou o marcar-todos com **dois** argumentos: *"o caso medido é de 5 trechos"* (premissa, que o caminho amplo derruba: 25) e o custo da caixa de estado misto do APG, que exige `indeterminate` — propriedade de DOM escrita por `ref`, o único trecho imperativo de um painel declarativo. **O segundo argumento não se aplica:** dois botões de texto não são caixa de estado misto, não têm `indeterminate` e não têm `ref`. Com 25 itens todos marcados e um veredito de `não cabe`, a alternativa é vinte cliques.

Escopo deliberado: **só a aba Trechos**, agindo sobre as chaves dela. Notas vão a 5 mesmo no caminho amplo, e um par por aba seria duplicar o controle para poupar um clique. **Presentes sempre** (fora de `frozen`, quando a seleção é inerte por D23G.7) — um limiar do tipo *"aparece acima de N itens"* seria número inventado, e este projeto já pagou por régua fixada sem consequência medida.

**D23J.9 — a parte persistida não registra a amplitude.** `DocsPart` não ganha campo. A contagem de trechos **é** o registro do que veio, o corte barato para mexer na forma da parte era o 23-C (D23C.1) e passou, e nada na tela responderia diferente sabendo se a resposta foi ampla. Dito aqui para não parecer esquecimento.

**D23J.10 — os três `aria-expanded` ficam adiados, e o adiamento se escreve no registro que os prometeu.** O [`ROADMAP § 4`](../../ROADMAP.md) os chama de *"candidata ao 23-J"*; terminada esta sessão, essa linha mentiria por omissão. Passa a dizer que foram considerados e adiados **neste** corte, com o motivo: é dívida de precisão (um leitor de tela diz "pressionado" onde diria "expandido"), não barreira, e o custo não cresce com o tempo.

---

## Passos

### Passo 1 — a variante inline do `MarkdownMessage`, e os quatro títulos

**Arquivos:** `shared/ui/MarkdownMessage/MarkdownMessage.tsx` · `MarkdownMessage.module.css` · `features/docs/DocsSnippetList.tsx` · `DocsLine.tsx` · `DocsAttached.tsx`

1. Prop `inline?: boolean` (default `false`). Quando verdadeira: `disallowedElements={['p']}`, `unwrapDisallowed`, e o contêiner é `<span className={styles.inline}>` em vez de `<div className={styles.markdown}>`.
2. No módulo CSS, `.inline` **não declara `font-size`** — herda. Os seletores que um título precisa (`code`, `a`, `strong`/`em` vêm do browser) passam a valer para os dois contêineres: `.markdown code, .inline code { … }` e o par equivalente para `a`. **Só semântico** — o `guard` recusa `#hex` e `--gray-N` neste arquivo.
3. Os quatro chamadores trocam `{snippet.title}` por `<MarkdownMessage inline text={snippet.title} />`, mantendo o `truncate` no `<span>` de fora que já existe.

⚠️ **O `aria-label` do `↗` continua com o título cru** (`Abrir a fonte de ${snippet.title}`): um leitor de tela lê o acento grave, o que é ruído e não engano, e transformá-lo em texto plano exigiria o partidor de markdown que D23J.2 recusa. Registrado como aceito, não como pendência.

**Testes (nível 2), com o vermelho que espero de cada um:**

| Teste | Vermelho |
|---|---|
| `inline` não emite `<p>` e emite `<code>` para `` `x` `` | remover `disallowedElements` → o `<p>` volta e a asserção cai |
| `inline` herda o tamanho: o `<span>` não recebe a classe `.markdown` | trocar o contêiner de volta por `styles.markdown` |
| o título do trecho renderiza `<code>` em vez de acento grave literal | devolver `{snippet.title}` cru → `getByText` do acento grave passa a achar |

⚠️ **Sabote estreito.** Um dos vermelhos deste passo é fácil de "provar" anulando o componente inteiro, o que derruba as três asserções sem exercitar nenhuma — é o erro que o 23-F pagou com duas sabotagens no mesmo teste.

### Passo 2 — `broad` atravessa as camadas, e a caixa na primeira tela

**Arquivos:** `shared/ipc.ts` · `core/context7/client.ts` · `main/features/context7/handlers.ts` · `features/docs/docsContext.ts` · `DocsProvider.tsx` · `useDocsFetch.ts` · `DocsCompose.tsx`

1. `argsSchema['docs:fetch']` ganha `broad: z.boolean().optional()`; a `Api.docs.fetch` ganha o campo com docstring TSDoc de uma linha. **Nenhum canal novo** — seguem 54.
2. `fetchLibraryContext` recebe `broad?: boolean` e manda `fast: args.broad === true ? 'true' : 'false'`. O comentário de `client.ts:18` (hoje afirma `fast=false` como se fosse o único caminho) é reescrito apontando DM-18 e D23J.3.
3. `fetchDocs` no handler: a chave do memo passa a `fetch|${libraryId}|${version ?? ''}|${broad === true ? 'broad' : 'narrow'}|${query}` — **D23J.4**, com comentário curto de ~3 linhas dizendo o que a ausência dela produziria.
4. `DocsComposition` ganha `broad: boolean`; `setBroad` entra no `DocsApi`; `toggle` (composição nova) e `clearPending` semeiam/zeram `false` (**D23J.5**); `fetchDocs` passa `...(current.broad ? { broad: true } : {})`, a mesma forma que `version` e `refresh` já usam.
5. `DocsCompose`: a linha nova entre o `Field` da Pergunta e o aviso de privacidade — `<label>` envolvendo o `<input type="checkbox" className="size-6 flex-none accent-accent">` (mesma forma de `DocsSnippetList`) e o texto. Rótulo `consulta ampla`, com a linha de custo abaixo em `text-xs text-text-faint`: **até 25 trechos em vez de ~5, pela mesma consulta da cota; sem reranqueamento, a ordem é arbitrária.**

**Testes:**

| Nível | Teste | Vermelho |
|---|---|---|
| 1 | `client.test.ts`: `broad: true` põe `fast=true` na URL; ausente põe `fast=false` | inverter o ternário — os dois casos trocam de lado |
| 3 | `handlers.test.ts`: consulta estreita memoizada **não** responde à consulta ampla, e vice-versa | voltar a chave antiga → a segunda chamada devolve a primeira resposta sem tocar o `fetchFn` (a asserção é a **contagem de chamadas** do fetch, não só o conteúdo) |
| 2 | `docs.test.tsx`: a caixa nasce desmarcada; marcada, `docs.fetch` recebe `broad: true`; depois de anexar e enviar, ela volta desmarcada | remover a semeadura de `clearPending` derruba só o terceiro |

⚠️ **O terceiro teste de nível 2 é o mais fácil de nascer vacuoso** — afirmar "está desmarcada" depois de `clearPending` passa se a caixa nunca foi marcada. A forma que prova é marcar, anexar, enviar e **então** afirmar; e reprovar sob sabotagem antes de confiar.

### Passo 3 — `marcar todos` / `desmarcar todos`

**Arquivos:** `features/docs/useDocsSelection.ts` · `DocsSnippetList.tsx` · `DocsResult.tsx`

1. O hook ganha `markAll(keys)` (retira essas chaves do conjunto de fora) e `clearAll(keys)` (acrescenta todas) — **o conjunto continua sendo o de fora** (D23G.3 intacta), e as duas operações são escopadas às chaves recebidas, o que é o que torna "só a aba Trechos" expressável em vez de disciplina.
2. `DocsSnippetList` recebe `onMarkAll`/`onClearAll` opcionais e desenha o par acima da lista, ausente quando `frozen` — `DocsAttached` não os passa, e continua com `ALL_ON`/`NOOP`.
3. `DocsResult` liga os dois às chaves de `docs.snippets`.

**Testes (nível 2):** `desmarcar todos` zera o rodapé para `0 de 26 · nada a anexar` e desabilita `Anexar`; `marcar todos` devolve a soma exata; os botões **não** existem na releitura. Vermelho: passar as chaves de `[...snippets, ...notes]` em vez de só as de trechos derruba a asserção do total, que é justamente o escopo de D23J.8.

### Passo 4 — verificação ao vivo (do dono) e fechamento

O roteiro, escrito contra o que existe **neste** corte:

1. Consulta normal (caixa desmarcada): o rodapé e a contagem seguem como no 23-I — nada regrediu.
2. Um trecho cujo `codeTitle` traga acento grave: o título mostra **chip de código**, não o caractere. Se a biblioteca da vez não trouxer, vale qualquer consulta a `/tanstack/query`, onde o 23-G o viu de primeira.
3. O mesmo título na **linha da transcrição** (corpo aberto) e na **releitura** — os três lugares concordam.
4. Marque `consulta ampla`, consulte a **mesma** biblioteca com a **mesma** pergunta: vêm ~25 trechos, e **não** a resposta estreita de antes (é D23J.4 na tela; o caminho errado aqui é rápido e gratuito, e é assim que ele engana).
5. O rodapé com 25 marcados: se `não cabe` aparecer, é a **primeira vez ao vivo** — confira que `Anexar` está desabilitado e que `desmarcar todos` o destrava.
6. `Consultar de novo` mantém a amplitude; `Ver de novo` devolve a mesma resposta de graça (a cota na primeira tela não se move).
7. Cronometre a consulta ampla — a pesquisa diz que `fast=true` é **mais rápido** (pula o reranqueamento deles), então o gatilho do `invoke`-vs-job deve seguir dormindo. Se ela vier **mais lenta** que 2–3 s, é achado contra a fonte e vai para a errata.
8. Desmarque a caixa, anexe e envie: a caixa volta desmarcada na consulta seguinte (D23J.5).

**Fechamento:** diário, escalonamento do que valer além do plano, `check:fast` **remedido** (nunca copiado dos 157/1556 do 23-I), errata devolvida aos três documentos do guia — `README.md` (23-J entregue, forquilhas 8/9/10/13 fechadas, 10 como adiada), `decisoes.md` (DM-18 com o *como*, DM-28 com o título consertado, DM-16/25 com o par de botões), `painel.md` (a primeira tela ganha a caixa; o `+` registrado como decidido-a-não-existir) —, `ROADMAP § 4` (a pendência do título **sai**; a dos `aria-expanded` passa a "considerada e adiada no 23-J"), as sete skills conferidas, e o plano movido para `implemented/` com entrada no `HISTORY.md`.

⚠️ **A 11ª entrada de marco empurra a mais antiga para o `HISTORY-archive.md` na mesma edição** — régua (d) do `CLAUDE.md`.

---

## Verificação

| Portão | O quê |
|---|---|
| `pnpm typecheck` | os três projetos; `Api.docs.fetch` mudando de forma cobra `test/api-mock.ts` no mesmo segundo |
| `pnpm exec vitest related <arquivo>` | por passo, durante — chamador e chamado **na mesma leva** (lição medida do 23-G) |
| `pnpm check:fast` | uma vez por commit, via o `commit_gate` |
| Ao vivo | o roteiro de 8 pontos acima, do dono — os itens 4 e 5 não têm substituto em teste |

⚠️ **Custo de cota deste corte: ~2 chamadas reais** (uma estreita, uma ampla na mesma pergunta). A suíte nunca bate na API — as fixtures de `core/context7/__fixtures__/` já incluem `context-tanstack-query-fast.json`, gravada no 23-A, então **o caminho amplo tem fixture real desde antes de existir**.

---

## Riscos nomeados

| Risco | Por que é aceitável |
|---|---|
| 25 × `MarkdownMessage` numa lista (título + descrição) | a skill `design-system` já decidiu a régua: se o custo do `react-markdown` numa legenda incomodar, **a resposta é medir, não escrever um parser**. O caminho amplo é opt-in, e 25 é o teto medido |
| a ordem dos 25 é arbitrária (sem reranqueamento) | é o que o rótulo da caixa **diz**, e a ordenação do app existe para dar determinismo e nunca relevância (D23A.4, `api.md`) |
| `.inline` e `.markdown` divergirem no CSS | os seletores compartilhados ficam numa lista só; um terceiro contêiner é que cobraria extração |

---

## Diário de execução

| Data | O que mudou | Observações |
|---|---|---|
| | | |
