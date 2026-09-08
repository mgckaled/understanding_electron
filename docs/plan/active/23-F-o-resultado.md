# 23-F — O resultado

> Sexto dos **onze** cortes do **arco 23** (documentação por REST), e o terceiro visível. Material de entrada: [`reference/context7/`](../../reference/context7/README.md) e os três anexos ([`api.md`](../../reference/context7/api.md), [`decisoes.md`](../../reference/context7/decisoes.md), [`painel.md`](../../reference/context7/painel.md)), lidos inteiros antes de escrever este plano, mais os diários dos cinco cortes já implementados. **Nenhum subcorte:** se ele crescer demais, vira dois irmãos no mesmo nível.

## Contexto

O [23-E](../implemented/23-E-a-desambiguacao.md) entregou a tela 2 e ligou o `Consultar` dela — a segunda chamada paga já sai, e a resposta chega inteira ao renderer. Mas ela é desenhada como **uma linha de contagem** (`5 trechos · 0 notas · sem regras`) dentro da própria tela de candidatos, provisório declarado no plano daquele corte.

Este corte entrega o **Estado 3** do `painel.md`: a resposta como terceira tela, com as três abas — **Trechos**, **Notas** e **Regras** (esta só quando houver regra) —, o retrátil por trecho com o código colorido, o link de procedência e o rodapé com o custo exato.

**Nenhum canal é criado ou alterado**, pelo mesmo motivo do 23-E: `docs:fetch` já devolve `DocsResult` completo desde o 23-B, e `parse.ts` já anula a sentinela `"Unknown"` de `pageTitle` e já resolve `sourceUrl`. Corte 100% renderer.

## Sondagem — o que a leitura, a medição e a pesquisa encontraram

| # | Achado | Consequência |
|---|---|---|
| 1 | `DocsResult` (`snippets` · `notes` · `rules`) já viaja pronto, e `parse.ts:88` já troca `pageTitle: "Unknown"` por `null`, `sourceUrlOf` já devolve `null` quando o `codeId` não parseia | nada em `shared/`, `core/` ou `main/` é tocado |
| 2 | ⚠️ **`global` e `libraryTeam` só chegam com chave de *teamspace*.** A doc oficial (`docs/howto/rules.mdx`) diz que a regra criada no painel fica ativa *"for subsequent documentation requests made with the teamspace's API keys"*; só `libraryOwn` vem do `context7.json` do **repositório** | explica os 11/11 ausentes (as sondas foram anônimas) e **divide a procedência**: `libraryOwn` é de terceiro, as outras duas são do próprio dono da chave. O texto da aba não pode chamar as três de injeção alheia |
| 3 | O `openapi.json` oficial confirma `rules` como objeto **opcional** com exatamente as três arrays de string | `docRulesSchema` do 23-A casa; nada a corrigir |
| 4 | O memo de sessão do handler é `fetch\|libraryId\|version\|query` (`main/features/context7/handlers.ts:51`, D23B.10) | **`Consultar de novo` do mock é no-op:** os mesmos três valores devolvem o memoizado, custam zero de cota e redesenham a mesma tela |
| 5 | `Tabs` resolve a aba ativa com `tabs.find(...) ?? tabs[0]` | um resultado **sem** regras depois de um **com** não deixa o painel em aba morta — nenhuma sincronização a escrever |
| 6 | `ReasoningDisclosure` é o molde do retrátil: `aria-expanded`, `h-[0px]` (o `--spacing-*` só vai de 1 a 9) e `[height:calc-size(auto,size)]` | ⚠️ e traz junto o aviso do `painel.md`: o `↗` **não pode** ficar dentro do `<button>` do retrátil — botão dentro de botão é HTML inválido e o React não avisa |
| 7 | `resolveLanguage` (`core/draft/languages.ts:78`) já faz `trim().toLowerCase()` | `TypeScript` casa com `typescript`; `APIDOC` e `svelte` caem em `null` e viram texto puro. Nenhuma normalização nova |
| 8 | `infoSnippets` veio **vazio em 3 de 4** respostas `fast=false` ([`api.md`](../../reference/context7/api.md)) | a aba Notas precisa de estado vazio próprio, e ele é o **caso comum** |
| 9 | `blocks[]` são **variantes** do mesmo exemplo (TS e JS), **às vezes idênticas** (D23B.11); `tokens` cobre a lista inteira | renderizar as duas mostra o mesmo código duas vezes |
| 10 | `docs.test.tsx` está em **386** linhas | passa de 400 neste corte e pede um irmão, não mais um `describe` |

## Decisões

**D23F.1 — corte 100% renderer.** Achado 1.

**D23F.2 — a terceira tela é derivada, como a segunda.** `fetchState` resolvido em `status: 'ready'` desenha o Estado 3; **todo o resto** — `loading`, `error`, `empty`, `indexing`, `library-not-found` — continua na tela 2, no lugar hoje ocupado pela linha de contagem. Mesma forma de D23E.2: nenhuma variável de fase a manter em sincronia.

**D23F.3 — `Voltar` da tela 3 volta à tela 2, não ao formulário.** É `resetFetch` sozinho, ao lado do `resetSearch` que a tela 2 já usa. Sem ele a tela 3 é beco sem saída, porque `Anexar` é do 23-G — o mesmo argumento que fez o 23-D adiar a tela 2 até existir o `Voltar`.

**D23F.4 — o cabeçalho nomeia a biblioteca na tela 3.** `▤ /tanstack/query · v5.90.3`, e `▤ Documentação` nas telas 1 e 2. `histórico ▾` e `+` continuam **ausentes** (D23D.9): os dois pressupõem consulta anexada, que só existe do 23-G em diante.

**D23F.5 — sem `Consultar de novo`.** Achado 4: o memo o torna no-op. Ele é a ação da situação 3 da tabela de erros (`empty` — *"a biblioteca existe, mas nada respondeu"*), e só faz sentido depois de reformular a pergunta, que é campo da tela 1. Nasce no **23-I**, junto do texto que o motiva.

**D23F.6 — o rodapé diz o total exato, e não tem `Anexar`.** `5 trechos · 2 notas · 1.204 tok` substitui o `nada consultado`. O número vem da API, não de `charsPerToken` — é o único lugar do app com orçamento exato antes de enviar, e exibi-lo com essa confiança é honesto. Regras não entram na soma: nunca são enviadas (DM-17). Seleção, `cabe`/`não cabe` e `Anexar` são do 23-G.

**D23F.7 — a aba Regras aparece quando há regra, não quando o campo existe.** `rules` pode chegar como objeto com as três listas vazias; uma aba `Regras (0)` diria a mesma ausência com mais ruído. **Ausente, não desabilitada** (DF3B.2).

**D23F.8 — a aba Regras distingue a procedência das três listas.** Achado 2. `libraryOwn` é de quem publica a biblioteca — terceiro, e a superfície de injeção que DM-17 nomeia; `global` e `libraryTeam` chegam pela chave do próprio usuário. As três continuam **exibidas e jamais enviadas** (DM-17 intacta), mas o rótulo de cada grupo diz de onde veio, e o `⚠` da aba vale pelo que a decisão protege, não por acusar o dono da própria chave.

**D23F.9 — trecho é retrátil, o primeiro aberto.** Molde do `ReasoningDisclosure`. A lista se **varre** — é o que o 23-G vai exigir para escolher o que anexar —, e o primeiro aberto mostra a forma sem obrigar um clique. ⚠️ O `↗` é **irmão** do botão do retrátil, num contêiner flex, nunca filho (achado 6).

**D23F.10 — `↗` ausente quando não há procedência.** `codeId` tem dois formatos reais e `sourceUrlOf` já devolve `null` quando não parseia; ausente, não desabilitado (DF3B.2).

**D23F.11 — blocos idênticos dentro do mesmo trecho aparecem uma vez.** Achado 9: descarte por `code` já visto no mesmo trecho. Blocos diferentes aparecem os dois, cada um com sua linguagem — juntá-los foi o defeito que D23B.11 consertou.

**D23F.12 — o destaque de sintaxe reusa `tokenize` de `features/draft`.** Import entre features é livre e tem precedente (`conversation` → `settings`); `resolveLanguage` já normaliza caixa (achado 7). Promover `CodePreview` a primitivo exigiria antes **tirar `tokenize` de `features/draft`** — `shared/ui` não importa de `features/`, e o módulo também serve o editor CodeMirror: seria refatorar o rascunho dentro de um corte de documentação. O terceiro chamador é que cobra a extração.

**D23F.13 — densidade: metadado em chrome, código e prosa em leitura.** DM-28, copiando `ArtifactBody`: título do trecho, contagens, abas e rodapé em `text-xs`/`text-sm`; o código em `font-mono` e o texto corrido de Notas e Regras em `text-reading`.

## Passos — um commit cada

**1. A terceira tela, as três abas e o rodapé.**
`DocsResult.tsx` novo em `features/docs/`: cabeçalho derivado, `Tabs` (sem `keepMounted` — são listas, sobrevivem a desmontar), rodapé com o total e o `Voltar`. As três abas já nascem aqui, com Notas e Regras completas (são listas curtas) e **Trechos como lista de títulos e custo**, sem retrátil nem código ainda. `DocsProvider` expõe `resetFetch`; `DocsPanel` deriva a terceira tela e o título; a linha de contagem provisória do `DocsCandidates` sai.
🔴 **Vermelhos a provar, quatro:** (a) com `status: 'ready'`, os rádios **somem** e a `tablist` aparece — afirme os dois lados, senão uma derivação errada deixa as duas telas; (b) `Voltar` devolve a lista de candidatos **com o mesmo rádio marcado** — trocar `resetFetch` por `resetSearch` cai no formulário, e a asserção é o rádio marcado, nunca a ausência do resultado; (c) o total soma trechos **e** notas — somar só trechos muda o número; (d) `it.each` com `rules: null`, com as três listas vazias e com uma regra: a aba existe **só** no terceiro.

**2. O trecho abre.**
`DocsSnippetList.tsx`: o retrátil por trecho no molde do `ReasoningDisclosure`, o `↗` como irmão, os blocos com `tokenize` + `resolveLanguage`, e o descarte de bloco duplicado.
🔴 **Vermelhos a provar, três:** (e) o primeiro nasce **aberto** e o segundo **fechado** — afirme os dois, um retrátil que abrisse todos passaria com asserção só no primeiro; (f) dois blocos de mesmo `code` renderizam um, dois blocos diferentes renderizam dois; (g) sem `sourceUrl` não há `↗`, e com ele o clique chama `window.api.shell.openExternal` com a URL.
⚠️ **O destaque cabe em nível 2**: sob jsdom a **classe** é atribuída, só a cor não — afirme `.tok-keyword` num trecho de TypeScript. O veredito *"isso só se prova ao vivo"* já saiu errado por metade uma vez neste projeto.

**3. Verificação ao vivo e fechamento.**
Roteiro abaixo, conduzido pelo dono. Depois: diário, escalonamento do que valer além deste plano, `check:fast` **remedido** (arquivos/testes nunca copiados do 23-E), errata devolvida ao [`README.md`](../../reference/context7/README.md) § *O que a execução já contrariou*, ao aviso do topo do [`painel.md`](../../reference/context7/painel.md) e ao [`decisoes.md`](../../reference/context7/decisoes.md) § *O que a execução fez com estas 32* — **o achado 2 entra em DM-17 obrigatoriamente** —, e o plano movido para `implemented/` com entrada no `HISTORY.md`.

## Verificação ao vivo — do dono, com `pnpm dev`

O plano fica em `active/` até a confirmação. Custo: **duas** chamadas de cota, no item 1.

1. Abrir o painel, `tanstack query` + uma pergunta, escolher `/tanstack/query`, fixar uma versão, `Consultar`.
2. A tela 3 aparece; o cabeçalho vira `▤ /tanstack/query · <versão>`; as abas mostram `Trechos (N)` e `Notas (N)`, **sem** aba Regras.
3. O primeiro trecho já **aberto**, com o código colorido; os demais fechados. Clicar abre e fecha.
4. `↗` abre o GitHub no navegador **externo**; trecho sem procedência não mostra o `↗`.
5. Rodapé: `N trechos · N notas · N tok` — conferir que o total bate com a soma dos custos visíveis.
6. Setas ←/→ trocam de aba, `Home`/`End` vão às pontas (vem do primitivo `Tabs`).
7. `Voltar` devolve a lista com o mesmo candidato marcado; `Consultar` de novo é **instantâneo e custa zero** (memo, D23B.10).
8. Aba Notas: se vier vazia — é o caso comum (achado 8) —, o estado vazio aparece com texto próprio.
9. ⚠️ **A aba Regras não é verificável ao vivo.** Ausente em 11/11 respostas, e as duas listas de *teamspace* exigem chave de *teamspace* (achado 2), que o app ainda nem manda. Fica provada só por teste; a verificação ao vivo dela é candidata ao 23-I, quando a chave passar a ser exigida.

## Testes

Nível 2. `docs.test.tsx` está em 386 linhas (achado 10), então a tela nova nasce em **`docsResult.test.tsx`** irmão, não em mais um `describe`. Nada de nível 1 ou 3: nenhuma linha de `core/`, `shared/` ou `main/` muda.

⚠️ **`mount()` reinstala o mock** — todo `mockResolvedValue` vai **depois** dele, ou o teste passa a medir o default da fábrica (achado do 23-D).
⚠️ **Quatro testes vacuosos em cinco cortes**, todos por asserção na ordem errada ou por afirmar ausência onde a árvore do React já garantia. Cada 🔴 acima nomeia o **estado final** que o defeito inverteria.

## Fora do escopo

Caixas por trecho, total ao vivo e `Anexar` (23-G) · linha na conversa, contador no cabeçalho, `histórico ▾`, `+` (23-H) · os dez textos de erro em português, o `Consultar de novo` e a exigência de chave (23-I) · livro-razão e minúcias (23-K) · `ESCOPO.md`, silhueta dos ícones a 16px e guia antigo `⛔ consumido` (23-J) · promover o destaque de sintaxe a primitivo de `shared/ui` (D23F.12 — no terceiro chamador).

## Diário de execução

| Data | O que mudou | Observações |
|---|---|---|
| 08/09/2026 | Plano escrito a partir do guia do arco 23; D23F.1–D23F.13 fixadas | Duas forquilhas resolvidas pelo dono: trecho retrátil com o primeiro aberto, e destaque de sintaxe reusando o tokenizer do rascunho. **A pesquisa externa achou o que nenhuma sonda acharia:** `global` e `libraryTeam` só chegam com chave de *teamspace*, então as três listas de `rules` não têm a mesma procedência — e nenhuma delas podia ter aparecido nas 11 sondas anônimas |
| 08/09/2026 | Passo 1: a terceira tela, as três abas e o rodapé | **Achado contra o suposto, lendo `client.ts:80`:** `empty` só cobre trechos **e** notas vazios ao mesmo tempo, então um `ready` sem trecho nenhum é tela real — as duas abas ganharam estado vazio próprio, o que o plano previa só para Notas. Detalhe de TypeScript que decidiu uma linha: `docs.rules` precisou ser lido para um `const` local, porque narrowing de propriedade não sobrevive dentro da closure do `render` da aba. Os quatro vermelhos provados; o de "a lista some" precisou de **duas** sabotagens, porque anular a tela inteira prova só a metade "as abas aparecem" — a outra metade se prova renderizando as duas telas juntas |
| 08/09/2026 | Passo 2: o trecho abre | Vermelhos provados numa sabotagem tripla. ⚠️ **A primeira tentativa não rodou teste nenhum**: o `\&` escapado pelo shell entrou no `.tsx` e o arquivo virou erro de sintaxe — `Tests no tests` é o sintoma, e ele **não** é um vermelho, é a suíte não tendo corrido. O quarto teste do passo confirma o que a skill `testing` manda conferir antes de mandar algo para nível 4: o destaque de sintaxe **cabe** em jsdom pela classe (`.tok-keyword`), só a cor é que não |
