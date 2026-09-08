# 23-E — A desambiguação

> ✅ **Entregue em 08/09/2026.** Quinto dos **onze** cortes do **arco 23** (documentação por REST), e o segundo visível. Material de entrada: [`reference/context7/`](../../reference/context7/README.md) e o anexo [`painel.md`](../../reference/context7/painel.md), lidos inteiros antes de escrever este plano. **Nenhum subcorte:** se ele crescer demais, vira dois irmãos no mesmo nível, nunca um `23-E-1`.

## Contexto

O [23-D](../implemented/23-D-o-painel-nasce.md) abriu o painel e ligou a busca de verdade — mas o resultado sai como **lista crua de `id` e título dentro do formulário**, por um slot `result` do `DocsCompose`. Aquilo foi provisório por uma razão declarada no diário: sem o `[ Voltar ]` do desenho, uma segunda tela deixaria o painel sem saída.

Este corte entrega o **Estado 2** do `painel.md`: a lista de candidatos como segunda tela, com a ordenação do app visível, a escolha por rádio, o seletor de versão e o caminho de volta. E, no fim dele, o `Consultar` da tela 2 dispara o `docs:fetch` — a segunda chamada paga —, com render provisório que o 23-F substitui pelas três abas.

**Nenhum canal é criado ou alterado.** O contrato já está pronto desde o 23-B: `docs:fetch` aceita `version?` e o cliente monta `${libraryId}/${version}`. É corte 100% renderer.

## Sondagem — o que a leitura e a medição encontraram

| # | Achado | Consequência |
|---|---|---|
| 1 | `argsSchema['docs:fetch']` já tem `version: z.string().min(1).optional()`, e `client.ts:64` monta `${libraryId}/${version}` | nada em `shared/`, `core/` ou `main/` é tocado. `security-boundary.spec.ts` afirma a lista exata de domínios do `Api` e **não** entra neste corte |
| 2 | Confirmado contra a doc oficial vigente: fixar versão é `/owner/repo/<version>` **ou** `@<version>` | a forma que o 23-A escolheu é uma das duas documentadas — nada a corrigir |
| 3 | ⚠️ **`versions[]` pode ficar vazia depois do filtro.** `/reactjs/react.dev` traz **só** `"__branch__v18"` ([`api.md`](../../reference/context7/api.md) achado 5), e `parse.ts:40` descarta todo `__branch__*` | "nenhuma versão indexada" é estado real da tela, não caso de borda hipotético |
| 4 | `/vercel/next.js` traz **16** versões na fixture, com dois separadores na mesma lista (`v5.90.3` e `v5_84_1`) | o controle precisa aguentar lista longa e heterogênea. `SegmentedField` (faixas fixas) não serve |
| 5 | `base.css:18` declara `color-scheme: dark`, redefinido para `light` no `@media` | o popup de um `<select>` nativo já sai no tema do app, desenhado pelo Chromium — sem CSS nosso |
| 6 | `id` se repete **dentro de uma resposta**: a fixture de `tanstack query` traz `/tanstack/query` duas vezes (benchmark 89,48 e 87,66) | a seleção endereça `key` (sintética, `${id}#${benchmarkScore}#${totalSnippets}`), nunca `id` — D23A.5 |
| 7 | `stars: -1` vira `null` em todo `/websites/*` (`parse.ts:37`); **3 dos 5** candidatos da fixture não têm estrela | a linha desenha sem estrela, jamais `0 ★` |
| 8 | O estado da busca vive hoje em `DocsPanel` (`useDocsSearch`), que desmonta ao fechar o painel | fechar no meio perderia a lista, contrariando o *retoma* de D23D.2. O memo de sessão do handler (D23B.10) faz a repetição custar **zero** de cota — o que se perde é latência e a tela, não a cota |
| 9 | `no-libraries` viaja **dentro** do `ready` (D23A.3), não como `empty` do `ViewState` | a troca de tela deriva de `outcome.status`, sem precisar de uma variável de fase nova |
| 10 | O Chromium já implementa o padrão *Radio Group* do WAI-ARIA APG em `<input type="radio">`: Tab entra no marcado, setas movem **e** marcam, com volta do último ao primeiro | um `role="radiogroup"` com `tabindex` rotativo reimplementaria de graça o que a plataforma entrega — o inverso do que `Tabs` precisou fazer |
| 11 | `docs.test.tsx` tem 172 linhas e monta a pilha inteira por `providers()` + `installApiMock()` | ⚠️ e a armadilha que o 23-D registrou vale aqui: `mount()` reinstala o mock, então `mockResolvedValue` definido **antes** dele é descartado em silêncio |

## Decisões

**D23E.1 — corte 100% renderer.** Achado 1: contrato, cliente e handler já entregam versão. Um canal novo aqui seria trabalho inventado.

**D23E.2 — a fase é derivada, nunca guardada.** A tela 2 aparece quando a busca resolveu em `found`; qualquer outro estado (`loading`, `error`, `no-libraries`) continua desenhado na tela 1. `[ Voltar ]` é o `reset()` do `useAsyncAction`, e não há um terceiro valor a sincronizar. Achado 9 é o que torna isso possível sem variável nova.

**D23E.3 — o estado da busca sobe para o `DocsProvider`.** ⚠️ **A justificativa original deste plano estava errada, e o passo 1 a derrubou.** Ela dizia que deixar a busca no painel perderia a lista ao fechar — não perde: `DocsPanel` **retorna `null`**, nunca desmonta, então os hooks dele guardam estado através de fechar e reabrir. O teste escrito para provar isso passou sob sabotagem e foi removido. A decisão continua de pé por duas razões que sobrevivem: o `Voltar` e a seleção vivem em `DocsCandidates`, um filho, e precisam de dono acima dele; e a troca de conversa exige um `resetSearch` que o painel não tem como disparar. `useDocsSearch` passa a ser chamado no provider e viaja pelo contexto, como `setLibrary`/`setQuestion` já viajam.

**D23E.4 — a seleção endereça `key`, jamais `id`.** Achado 6: duas linhas com o mesmo `id` na mesma resposta é fato medido, não hipótese. Guardar `id` marcaria as duas.

**D23E.5 — rádios nativos dentro de `<label>`, num `<fieldset>`.** Achado 10. O conteúdo rico da linha (título, `id`, contagem de trechos, estrelas, benchmark) mora dentro do `<label>`, que é o alvo de clique inteiro. Nada de `role="radio"` à mão.

**D23E.6 — o primeiro candidato nasce marcado.** A ordem já é a do app (`benchmarkScore` decrescente, D23A.4), então o primeiro é o melhor palpite — e é onde o Tab entra, pelo padrão do achado 10. Uma lista sem nada marcado exigiria um estado "escolha alguma coisa" que o desenho não tem.

**D23E.7 — `<select>` nativo para a versão, com `padrão da biblioteca` como primeira opção.** Valor vazio significa `version: undefined` na chamada — "mais recente" não é calculável (D23A.6), então o padrão da biblioteca é a única escolha honesta por omissão. ⚠️ **Divergência deliberada de DS-4 passo 7**, que trocou um `<select>` nativo por popover no `ModelSelector`: lá as linhas são ricas (chips de capacidade, grupos, linhas travadas com dica); aqui a opção é uma string. Achado 5 remove o motivo de tema, e o `ModelPicker` tem 276 linhas das quais nada é reusável hoje — copiar o padrão ou fazer nascer um primitivo `Listbox` dobraria este corte por coerência visual de um controle que aparece uma vez.

**D23E.8 — trocar de candidato zera a versão escolhida.** As versões são da biblioteca selecionada; manter `v5.90.3` ao pular para `/websites/tanstack_query_v4` mandaria ao serviço uma versão que aquele `id` não indexa.

**D23E.9 — sem versões indexadas, o seletor fica ausente.** Achado 3: é o caso comum, não a borda — todo `/websites/*` da fixture tem zero. Ausente, não desabilitado (DF3B.2), e a contagem `N indexadas` some junto.

**D23E.10 — o `Consultar` da tela 2 liga o `docs:fetch`, com render provisório.** Mesma forma de D23D.6, e pela mesma razão: botão sem nada atrás é o que o projeto já recusou em `Código` (F2.8), e é o que faz a verificação ao vivo provar alguma coisa. O corpo provisório é uma linha de contagem (`7 trechos · 2 notas · sem regras`), substituída pelas três abas no 23-F.

**D23E.11 — o cabeçalho não muda.** `▤ /tanstack/query · v5` pressupõe consulta resolvida, que é o Estado 3. Aqui segue `▤ Documentação` e o fechar, como D23D.9 fixou.

## Passos — um commit cada

**1. O estado da busca sobe para o provider.**
`docsContext.ts`: `DocsComposition` ganha `candidateKey: string | null` e `version: string | null`; `DocsApi` ganha `search`, `searchState`, `resetSearch`, `selectCandidate`, `setVersion`. `DocsProvider.tsx` passa a chamar `useDocsSearch` e a expor tudo; `DocsPanel.tsx` deixa de chamar o hook e passa a ler do contexto. Nenhuma mudança visível — a tela continua exatamente a do 23-D.
🔴 **Vermelho a provar:** abrir o painel, buscar, fechar, reabrir — a lista tem de continuar lá. Com o hook no painel, o teste falha.

**2. `DocsCandidates.tsx` — a lista e o seletor.**
Componente novo em `features/docs/`. `<fieldset>` com um `<input type="radio">` por candidato dentro de `<label>`, o corpo da linha com título, `id`, `N trechos`, estrelas (só quando `stars !== null`) e `benchmark`; abaixo, o `<select>` de versão com `padrão da biblioteca` na frente e a contagem `N indexadas` ao lado, ambos ausentes quando `versions` está vazia. Formatação de número por `Intl.NumberFormat('pt-BR')`, como o resto do app.
🔴 **Vermelho a provar, três:** (a) dois candidatos de mesmo `id` — marcar o segundo não pode marcar o primeiro (achado 6); (b) candidato com `stars: null` não renderiza `★`; (c) trocar de candidato zera o `<select>` (D23E.8). ⚠️ O (c) é o que mais se parece com o teste vacuoso do 23-D: afirme o **valor final** do `<select>`, não a ausência de uma chamada.

**3. A troca de tela e o `Voltar`.**
`DocsPanel.tsx` escolhe entre `DocsCompose` e `DocsCandidates` pelo `outcome.status` (D23E.2). O slot `result` do `DocsCompose` passa a desenhar só o que **não** é `found` — `loading`, `error`, `no-libraries` —, e o comentário `até 23-E dar tela própria` sai junto. O rodapé da tela 2 ganha `[ Voltar ]`, que chama `resetSearch`.
🔴 **Vermelho a provar:** depois do `Voltar`, os dois campos ainda têm o texto digitado — `reset()` limpa a busca, não a composição.

**4. O `Consultar` da tela 2.**
`useDocsFetch.ts` no molde exato de `useDocsSearch` (mesmo `useAsyncAction`, mesma forma de `Result`). O botão manda `libraryId` do candidato marcado, `question` da composição e `version` quando houver. O corpo provisório desenha a contagem das três listas.
🔴 **Vermelho a provar:** com uma versão escolhida, o `version` chega ao `window.api.docs.fetch`; sem escolha, a chave **não** vai no payload (`undefined`, não string vazia — `min(1)` no schema recusaria).

**5. Verificação ao vivo e fechamento.**
Diário, escalonamento do que valer além deste plano, `check:fast` remedido (contagem de arquivos/testes **remedida**, nunca copiada do 23-D), errata devolvida ao [`README.md`](../../reference/context7/README.md) § *O que a execução já contrariou* e ao aviso do topo do [`painel.md`](../../reference/context7/painel.md), e o plano movido para `implemented/` com entrada no `HISTORY.md`.

⚠️ **E, novo neste corte, a errata em [`decisoes.md`](../../reference/context7/decisoes.md).** O `README.md` registra **premissa** que caiu; `decisoes.md` guarda as 32 `DM-n` e não tem onde dizer que uma delas mudou de forma ou envelheceu. Sem isso, quem consultar a sigla em 23-G lê a decisão original como se ainda valesse inteira. Nasce ali uma seção final — sigla · corte · o que mudou · motivo —, alimentada por **todo** fechamento de corte daqui em diante, não só por este.

## Verificação ao vivo — do dono, com `pnpm dev`

Ordem importa: os itens 1–4 não gastam cota nenhuma além de **uma** busca.

1. Abrir o painel pelo `+` → `Documentação`; digitar `tanstack query` e uma pergunta; `Consultar`.
2. A tela 2 aparece com **cinco** candidatos, `/tanstack/query` **duas vezes** (a duplicata que o 23-D já viu ao vivo), o primeiro marcado, os três `/websites/*` **sem estrela**.
3. Setas ↓/↑ percorrem e marcam os cinco, com volta do último ao primeiro; `Tab` entra no marcado, não no primeiro.
4. `[ Voltar ]` volta à tela 1 **com os dois campos preenchidos**; `Consultar` de novo é instantâneo (memo de sessão, D23B.10, custo zero de cota).
5. Selecionar `/tanstack/query` (o de 2.526 trechos) → o `<select>` lista **5** versões e diz `5 indexadas`; selecionar um `/websites/*` → o seletor **some**.
6. Abrir o popup do `<select>` e confirmar que ele sai no tema do app, não em branco (achado 5). ⚠️ É o único item que nenhum nível de teste alcança.
7. Fechar o painel na tela 2 e reabrir → a lista continua lá, sem nova chamada.
8. **Gasta cota:** `Consultar` na tela 2 → a linha de contagem aparece. Cronometrar esta chamada e anotar o número — é o gatilho de reversão medido que o guia deixou aberto (`invoke` vs job, [`README.md`](../../reference/context7/README.md) § *A fronteira*), e uma biblioteca grande com `fast=false` é exatamente o caso que faltava.

## Testes

Nível 2, em `docs.test.tsx` — que passa de 172 linhas e provavelmente pede um `docsCandidates.test.tsx` irmão no passo 2. Nada de nível 1 ou 3: nenhuma linha de `core/`, `shared/` ou `main/` muda.

⚠️ **Dois dos quatro passos do 23-D produziram teste vacuoso, os dois por asserção na ordem errada.** Cada 🔴 acima nomeia o estado final que o defeito inverteria — e o `mount()` reinstala o mock (achado 11), então todo `mockResolvedValue` vai **depois** dele.

## Fora do escopo

Estado 3 e as três abas (23-F) · caixas por trecho, total ao vivo e `Anexar` (23-G) · linha na conversa, contador no cabeçalho, `histórico`, `+` (23-H) · os textos em português dos dez erros, incluindo o `no-libraries` que hoje sai cru (23-I) · livro-razão e minúcias (23-K) · `ESCOPO.md`, silhueta dos ícones a 16px e guia antigo `⛔ consumido` (23-J).

## Diário de execução

| Data | O que mudou | Observações |
|---|---|---|
| 08/09/2026 | Plano escrito a partir do guia do arco 23; D23E.1–D23E.11 fixadas | Duas forquilhas resolvidas pelo dono: `Consultar` da tela 2 ligado com render provisório, e `<select>` nativo para a versão. Pesquisa externa obrigatória: o padrão *Radio Group* do APG (que o Chromium já implementa inteiro) dispensou um `radiogroup` à mão, e a doc oficial confirmou `/owner/repo/<version>` como uma das duas formas de fixar versão — nada a corrigir no 23-A |
| 08/09/2026 | Passo 1: o estado da busca sobe para o provider, e a premissa que caiu | ⚠️ **O teste escrito para provar D23E.3 passou sob sabotagem e foi removido.** `DocsPanel` **retorna `null`**, nunca desmonta — então o estado local dele já sobrevivia a fechar e reabrir, e nenhuma asserção de preservação distingue os dois desenhos. A decisão fica de pé por outras duas razões; a justificativa do plano foi corrigida em vez de mantida. Achado não previsto: a busca não é carimbada com a conversa, então a troca de conversa precisou de um `resetSearch` explícito |
| 08/09/2026 | Passos 2 e 3 fundidos: a tela 2 nasce | Separá-los deixaria `DocsCandidates` como código morto num commit inteiro. Duas escolhas contra o primeiro impulso: `ICON_SIZE` não tem `xs`, então a estrela é o caractere `★` do desenho em vez de um tamanho inventado; e a linha selecionada compõe-se por estado em React, não por `has-checked:` — nenhum `has-` foi construído aqui ainda, e a régua manda conferir no CSS construído. Vermelho provado nos três testes mais vacuosáveis |
| 08/09/2026 | Verificação ao vivo intermediária, pedida pelo dono antes de gastar cota | Os dez pontos conferidos na tela com `tanstack query`. O popup do `<select>` saiu no tema escuro — **D23E.7 confirmada ao vivo**, e a lista mostrou a bagunça que `api.md` previa (`v5.60.5`, `v5.71.10`, `v5_84_1`, `v4_29_19`, `v5.90.3`). Um defeito achado só pelo olho: faltava o `·` entre o ramo e as estrelas, e `main 45.043 ★` lia como um valor só |
| 08/09/2026 | Passo 3: o `Consultar` da tela 2 | `selected` subiu para o provider durante a execução: a chamada precisa do mesmo candidato que o rádio mostra, e duas quedas para o primeiro divergiriam calado. ⚠️ **`git checkout` num arquivo com trabalho não commitado apagou o passo inteiro no meio de uma prova de vermelho** — segunda vez na sessão que restaurar por caminho errado custou trabalho. Prova de vermelho se desfaz pela edição inversa, nunca pelo git, enquanto o passo não está commitado |
| 08/09/2026 | Verificação ao vivo final e fechamento | Consulta real: `pandas` / *como criar um dataframe*, versão `v1.3.0` fixada, **2 a 3 s** — o gatilho de reversão do `invoke`-vs-job **não** disparou, agora com uma pergunta real e não só uma sonda. Voltou `5 trechos · 0 notas · sem regras`. **Dois achados contra o suposto**, ambos escalados para a errata: `branch` **não** é sempre `main` (`master` em dois dos cinco), e a ordenação do app pôs uma biblioteca de nicho na frente do `pandas` de verdade. `check:fast` remedido: **153 arquivos / 1472 testes, 112,85 s** |
| 08/09/2026 | Duas skills atualizadas, depois do fechamento | Conferidas as sete: `ipc` sem deriva (53 canais, nenhum criado aqui) e `architecture` sem deriva (oito fatias, `docs` já contada no 23-D). Mudaram duas. **`design-system`** ganhou a régua de controle nativo — a skill registrava *plataforma em vez de biblioteca* só para sobreposição, e o único vestígio de `<select>` no repositório é o comentário dizendo que o `ModelPicker` substituiu um: quem a lesse concluiria que o nativo está fora. O critério escrito é a **riqueza da linha**, não gosto. ⚠️ `DocsCandidates` **não** entra na lista dos dez primitivos — mora em `features/` e tem um chamador. **`testing`** ganhou o quarto caso de teste vacuoso, de classe nova: não é limite do jsdom, é fato da árvore do React |
