# 23-G — seleção e orçamento

> Sétimo dos **onze** cortes do **arco 23** (documentação por REST), e o quarto visível. Material de entrada: [`reference/context7/`](../../reference/context7/README.md) e os três anexos ([`api.md`](../../reference/context7/api.md), [`decisoes.md`](../../reference/context7/decisoes.md), [`painel.md`](../../reference/context7/painel.md)), lidos inteiros antes de escrever este plano, mais os diários dos seis cortes já implementados. **Nenhum subcorte:** se ele crescer demais, vira dois irmãos no mesmo nível.

---

## Contexto — por que este corte existe

O [23-F](../implemented/23-F-o-resultado.md) entregou o resultado inteiro na tela: três abas, o trecho retrátil com código colorido, o `↗` de procedência e o rodapé com o custo exato. **Mas sem uma caixa de marcação sequer, e sem `Anexar`.** O rodapé diz quanto a resposta custa e não oferece nada a fazer com o número.

É a última parada antes de **DM-16** (seleção completa, caixa por trecho) e **DM-25** (painel interativo, não só de leitura), decididas em 07/09/2026 e que o [`decisoes.md`](../../reference/context7/decisoes.md) registra como *"adiadas na prática, não revogadas"* desde o 23-D. Este corte as encosta na tela.

O que ele entrega, e é a razão de o crivo existir: **o controle sobre o que vai ao modelo**. A etapa 5 do fluxo não aceita `limit` nem `tokens` — *não se modula o que vem, modula-se o que se faz com o que veio* —, então o volante inteiro está entre a resposta que chegou e a parte que é enviada. E é o único lugar do app onde o orçamento é **exato antes de enviar**: a API devolve `codeTokens`/`contentTokens` por trecho, enquanto em todo o resto `charsPerToken` é chute calibrado depois.

**Depende de F · C**, as duas satisfeitas: o 23-F desenhou a tela do resultado e o [23-C](../implemented/23-C-a-parte-e-a-persistencia.md) fixou o que a parte persiste (`DocsPart` com `omitted`, e o `case 'docs'` já dentro de `partForProvider`).

---

## Estado do código, confirmado lendo (10/09/2026)

| Peça | Como está | O que este corte faz com ela |
|---|---|---|
| `DocsPart` (`shared/ipc.ts`) | schema completo, com `omitted: DocsOmitted[]` e `enabled` | **nada a criar** — o 23-C já fixou a forma; falta quem a monte |
| `partForProvider` (`core/ai/messages.ts`) | `case 'docs'` devolve `formatDocsCard` quando `enabled` | **nada a tocar** — o modelo passa a receber sozinho |
| `docsPartOf` (`core/ai/messages.ts`) | `.find` — **uma** consulta por mensagem | fixa o invariante: um pendente por vez |
| `budgetFor` (`core/ai/budget.ts`) | tem `flatTokens?: number` para custo plano (imagem, D17.12) | **a porta exata**: token de Context7 é medido, não estimado por caractere |
| `Composer.tsx` | dono único do `budgetFor`, soma `attachmentChars` e `newImageCount` | soma os tokens da seleção e devolve o `Budget` pronto |
| `Composer.tsx` · `useConversationChat.ts` | `onSend(text, attachment, wantsReasoning)` → `parts` | ganha o terceiro payload |
| `DocsResult.tsx` | soma trechos + notas, exclui `rules` de propósito | vira soma **da seleção**, não do total |
| `DocsSnippetList.tsx` | um retrátil por trecho, o primeiro aberto | ganha a caixa, irmã do botão do retrátil |
| `ArtifactSteps.tsx` | `<input type="checkbox" className="size-6 accent-accent">` num `role="group"` | **o molde a copiar**, inclusive o `@utility accent-accent` que já existe |
| `DocsProvider.tsx` (157 linhas) | composição carimbada pela conversa, busca e resposta | ganha seleção e pendente, com a seleção extraída para hook próprio |

---

## As decisões

### D23G.1 — O `Composer` continua dono único do `budgetFor`, e publica o `Budget` de volta

`DocsPanel` é **irmão** da `ConversationView` na árvore (`App.tsx`, os dois sob `DocsProvider`), então não alcança `historyChars`, `limit`, `charsPerToken`, `costed` nem `anchor`. As duas saídas eram publicar os **insumos** para baixo (e o painel rodar o seu próprio `budgetFor`) ou publicar o **resultado**.

Vence o resultado, e o [`painel.md`](../../reference/context7/painel.md) já dizia por quê: *"a soma deve derivar do mesmo conjunto que `partForProvider` devolve, nunca de uma segunda contagem escrita à mão"*. Dois `budgetFor` são duas contas livres para divergir, e elas ficam **na tela ao mesmo tempo** — o rodapé do painel e o medidor do popover do modelo.

O fio, com uma direção de dado e uma de veredito:

```
painel  →  selectedTokens (estado no DocsProvider, escrito por handler)
              ↓
Composer:  budgetFor({ …, flatTokens: imagensNovas × 270 + selectedTokens })
              ↓
           reportBudget(budget)   ← efeito, com comparação rasa dos quatro campos
              ↓
rodapé:  "4 de 7 · ~588 tok · cabe (janela 32k, 71% livre)"
```

⚠️ **O efeito de volta precisa de guarda contra laço.** `budgetFor` devolve objeto novo a cada render; o `set` compara `estimated`, `limit`, `fits` e `messageAloneOverflows` e só escreve quando algum mudou. Sem isso é re-render infinito — e é o vermelho a provar naquele passo.

### D23G.2 — Tokens de Context7 entram por `flatTokens`, nunca por caractere

`draftChars` estima por `charsPerToken`; a API devolve a contagem exata. Somá-la a `draftChars` jogaria fora a única medida exata que o app tem, e a estimativa por caractere subconta em até ~1/3. `flatTokens` já existe para exatamente isso (custo de imagem, D17.12) e soma **depois** da razão.

⚠️ **Assimetria assumida, e registrada para não ser descoberta depois:** uma consulta **já na transcrição** volta a ser estimada por caractere, porque `historyCharsOf` mede o texto de `formatDocsCard`. O exato vale para o **pendente**; o histórico segue a régua de todo o resto. Corrigir isso seria carregar o token real por parte no orçamento de história inteira — assunto do 23-K, não deste corte.

### D23G.3 — Seleção é o conjunto do que está **de fora**, não do que está dentro

`Set<string>` de chaves desmarcadas, molde exato do `off` de `ArtifactSteps`. Tudo nasce marcado (é o que o usuário pediu ao consultar), e o conjunto vazio significa "tudo vai" — o caso comum. O inverso obrigaria a semear o conjunto com todas as chaves na chegada da resposta, num efeito, e a ressemeá-lo a cada consulta nova.

A chave é a `key` sintética de `DocSnippet`/`DocNote` — nunca o índice, e nunca `sourceUrl`: `codeId` endereça a **página**, e cinco trechos do zod compartilharam um só (D23A.5).

### D23G.4 — Notas têm caixa, como os trechos

Não é escolha nova: `docsOmittedSchema` já tem `kind: 'snippet' | 'note'` desde o 23-C. Uma nota sem caixa deixaria metade do `omitted` inalcançável, e o campo viraria código morto.

Título de nota omitida = `breadcrumb ?? 'sem trilha'` — `DocNote` não tem `title`, e é a mesma queda que a aba já desenha hoje.

### D23G.5 — Sem "marcar todos"

O caso medido é de **5 trechos**, e nenhuma sonda passou disso. A caixa de estado misto do padrão *Checkbox (Mixed-State)* do WAI-ARIA APG poupa no máximo quatro cliques e cobra o único pedaço imperativo de um painel inteiramente declarativo: `indeterminate` **não é atributo JSX** — é propriedade de DOM, escrita por `ref` num efeito (confirmado na documentação oficial do React). O teste dela também não olharia a tela, e sim a propriedade.

Nasce quando a lista crescer. Com `fast=false` fixado em DM-18, ela não cresce.

### D23G.6 — `Anexar` desabilita por dois motivos, e cada um diz o seu

| Situação | `Anexar` | O que o rodapé diz |
|---|---|---|
| Nada marcado | desabilitado | `0 de 5 · nada a anexar` |
| Marcado, e não cabe | desabilitado | `3 de 5 · ~588 tok · não cabe na janela de 32k` |
| Marcado, e cabe | ligado | `3 de 5 · ~588 tok · cabe (janela 32k, 71% livre)` |

`disabled` nativo, não `aria-disabled` — é o que o `Button` do projeto já faz, e a razão fica **no texto ao lado**, que é o que torna a recusa descobrível sem inventar um segundo padrão de desabilitado no app.

⚠️ **Recusar antes é a única defesa.** O Ollama descarta o começo do prompt em silêncio quando não cabe — sucesso silencioso, não exceção. É o mesmo argumento de `budgetFor.fits` (D15.5).

### D23G.7 — `Anexar` congela um pendente por vez, carimbado pela conversa

`docsPartOf` usa `.find`: **uma** consulta por mensagem. O pendente mora no `DocsProvider` como `{ conversationId, part: DocsPart }`, carimbado pelo mesmo motivo que a composição já é (D23D.2) — trocar de conversa não pode levar a consulta junto.

O congelamento copia a trava de janela (D15.13): depois de `Anexar`, a tela do resultado fica **só de leitura** — caixas desabilitadas, `Anexar` some. Alterar a seleção depois faria a tela divergir do que o modelo viu.

`id` nasce no renderer por `crypto.randomUUID()`, como todo id deste projeto (D14.5).

### D23G.8 — O envio limpa tudo e o painel volta ao Estado 1

Depois que a mensagem sai, a consulta vive na transcrição — não no painel. `submit` limpa o pendente, a resposta e a composição juntos, e o painel volta ao formulário vazio. O caminho de volta para uma consulta já enviada é o `histórico ▾`, que é do **23-H**.

### D23G.9 — Divergência deliberada: nenhum sinal fora do painel neste corte

Com o painel fechado, o único sinal de consulta pendente é o **medidor do popover do modelo subindo**. Contador no cabeçalho da conversa e linha retrátil na transcrição são do 23-H, e adiantá-los aqui esvaziaria aquele corte.

Consequência a dizer em voz alta, porque parece defeito: entre este corte e o 23-H, uma mensagem enviada com consulta **chega ao modelo de verdade** (`partForProvider` já trata `docs` desde o 23-C) e **não aparece na transcrição**. É buraco de um corte, não pendência esquecida.

### D23G.10 — O montador da parte é função pura em `core/`

`docsPartFrom(input)` em **`src/core/context7/part.ts`** — nível 1, dentro da meta de 85% de `core/`. Recebe a resposta, o conjunto de chaves desmarcadas e os metadados (biblioteca, versão, pergunta, id) e devolve a `DocsPart`. É onde a regra de D23C.3 vira código: o recusado vira **título e custo**, nunca código.

Escrever isso dentro do handler de clique do painel o deixaria em nível 2, onde a asserção é sobre a tela e não sobre a forma do dado que vai ao banco.

---

## Os passos

Cada um é um commit, com `pnpm check:fast` verde ao fim e **um vermelho provado** antes de cada verde.

### Passo 1 — a seleção, e o rodapé que conta

- `useDocsSelection.ts` (hook novo, `features/docs/`): `Set<string>` de chaves desmarcadas, `toggle(key)`, `reset()`, `isOn(key)`. Hook próprio e não mais estado no `DocsProvider` porque este já vai a 157 linhas e ganha o pendente no passo 3 — coesão pesa abaixo do teto.
- `DocsSnippetList`: caixa **irmã** do botão do retrátil, nunca dentro (`<button>` dentro de `<button>` é HTML inválido e o React não avisa — a mesma armadilha que o `↗` já resolveu ali). `role="group"` na lista, molde de `ArtifactSteps`.
- A aba Notas ganha a mesma caixa.
- `DocsResult`: a soma passa a ser **da seleção**; rodapé vira `N de M · ~X tok`. `rules` continua fora da conta, de propósito.
- Sem `Anexar` ainda.

**Nível 2.** Vermelhos a provar: desmarcar derruba a soma; a caixa de uma nota conta na mesma soma; `rules` não entra na conta (sabotagem: somar `ruleCount`).

⚠️ Sabotagem estreita, uma por asserção — anular a lista inteira prova a metade que aparece e deixa a metade que soma sem exercício (a régua que o 23-F pagou).

### Passo 2 — o orçamento atravessa

- `docsContext.ts`: `selectedTokens: number`, `setSelectedTokens`, `budget: Budget | null`, `reportBudget`.
- `Composer.tsx`: soma `selectedTokens` em `flatTokens`, e um `useEffect` chama `reportBudget(budget)` com a guarda de comparação rasa.
- `DocsResult`: rodapé passa a dizer `cabe (janela 32k, 71% livre)` / `não cabe na janela de 32k`, derivado do `Budget` publicado.

**Nível 2.** Vermelho a provar: **tirar a guarda do efeito** e ver o teste estourar por atualização em laço — é o defeito que este passo introduz se ninguém o segurar, e vê-lo acontecer é o que dá valor à guarda.

### Passo 3 — `Anexar`, o pendente e o envio

- `src/core/context7/part.ts` — `docsPartFrom`, com TSDoc.
- `DocsProvider`: `pending`, `attach(part)`, `clearPending()`; congelamento derivado de `pending !== null`.
- `DocsResult`: `Anexar`, com as duas razões de desabilitar (D23G.6); estado só-leitura quando anexado.
- `Composer.tsx` → `onSend(text, attachment, docs, wantsReasoning)`; `useConversationChat.send` monta `parts` com a parte de docs; `submit` chama `clearPending()`.
- `test/api-mock.ts` não muda (nenhum canal novo) — e é o sinal de que este corte é 100% renderer + `core/`.

**Níveis 1 e 2.** Vermelhos a provar:

- omitido carrega título e custo e **nunca** `blocks` (sabotagem: copiar o trecho inteiro para `omitted`);
- nota omitida usa `breadcrumb`;
- `rules` sobrevive na parte mesmo com tudo desmarcado (D23C.4);
- a mensagem enviada carrega a parte, e `partForProvider` a materializa;
- `Anexar` desabilitado com nada marcado, e com `fits: false`.

⚠️ **Prova de vermelho se desfaz pela edição inversa, nunca por `git checkout`** — a armadilha que o 23-E pagou duas vezes na mesma sessão.

### Passo 4 — verificação ao vivo e fechamento

Roteiro abaixo, conduzido pelo dono. Depois: diário, escalonamento do que valer além deste plano, `check:fast` **remedido** (arquivos/testes nunca copiados do 23-F), errata devolvida aos três documentos do guia, e o plano movido para `implemented/` com entrada no [`HISTORY.md`](../../HISTORY.md).

**Errata obrigatória — [`decisoes.md`](../../reference/context7/decisoes.md) § *O que a execução fez com estas 32*:** **DM-16 e DM-25 saem de "adiadas"**. Elas aparecem lá duas vezes como pendentes; este é o corte que as cumpre, e deixá-las como estão seria a contagem envelhecendo calada em dois lugares.

---

## Como isto se verifica ao vivo

Não é opcional, e é do dono — a lista abaixo é o que olhar, com prints. Duas consultas reais, **duas chamadas de cota** (`Ratelimit-Remaining` estava em 146 depois da sonda do 23-A; remedir no header antes de citar).

1. Consultar `/tanstack/query` — a resposta abre com **tudo marcado** e o rodapé dizendo `5 de 5 · ~741 tok · cabe`.
2. Desmarcar dois trechos: o rodapé desce **na hora**, e o número bate com a soma dos que sobraram.
3. Abrir o popover do modelo: o **medidor do composer** subiu junto, e os dois números concordam. ⚠️ É a asserção que o jsdom não faz — divergir aqui é o defeito que D23G.1 existe para impedir.
4. Desmarcar **tudo**: `Anexar` desabilita e o rodapé diz `nada a anexar`.
5. Trocar para uma conversa com janela pequena (4096) e consultar de novo: `Anexar` desabilita com `não cabe`, e o texto nomeia a janela.
6. `Anexar` com três marcados: as caixas ficam inertes, `Anexar` some, e a tela vira só-leitura.
7. Escrever uma mensagem e enviar: o painel volta ao formulário vazio. **A transcrição não mostra a consulta — é esperado (D23G.9).**
8. Confirmar que o modelo **recebeu**: perguntar algo que só a documentação consultada responde, e ver a resposta usar o trecho.
9. Anexar uma consulta e **trocar de conversa** sem enviar: o pendente não segue, e o medidor da outra conversa não sobe.
10. Uma nota marcada e um trecho desmarcado, enviados juntos — o `omitted` guarda os dois tipos.

---

## Arquivos

**Novos:** `src/core/context7/part.ts` · `src/core/context7/part.test.ts` · `src/renderer/src/features/docs/useDocsSelection.ts`

**Tocados:** `docsContext.ts` · `DocsProvider.tsx` · `DocsResult.tsx` · `DocsSnippetList.tsx` · `features/conversation/Composer.tsx` · `features/conversation/useConversationChat.ts` · `features/conversation/ConversationView.tsx` · `features/docs/docsResult.test.tsx` · `features/docs/docs.test.tsx`

**Não tocados, e vale dizer:** `src/shared/ipc.ts` (nenhum canal novo — os 53 continuam 53) · `src/main/**` · `src/preload/index.ts` · `core/ai/messages.ts`.

⚠️ Régua de tamanho a vigiar: `DocsResult.tsx` está em 147 e ganha rodapé e `Anexar`; se passar de 250 no alvo, `NoteList` sai para arquivo próprio — divide-se ao tocar.

---

## Diário de execução

| Data | O que mudou | Observações |
|---|---|---|
| 10/09/2026 | Plano escrito a partir do guia do arco 23 e dos seis diários; D23G.1–D23G.10 fixadas | Quatro forquilhas resolvidas pelo dono: o `Composer` segue dono único do `budgetFor` e soma no medidor principal, `Anexar` liga até o envio, sem "marcar todos", e nenhum sinal fora do painel neste corte. Pesquisa externa: a documentação oficial do React confirmou que `indeterminate` não é atributo JSX — o custo que barrou o marcar-todos —, e o WAI-ARIA APG deu o nome e a forma do padrão de estado misto que ficou de fora |
| 10/09/2026 | Passo 1: a caixa por item e o rodapé que conta a seleção | Duas correções contra o próprio plano: o `frozen` de `DocsSnippetList` **saiu** deste passo (seria sempre `false` até o passo 3 — ponto de extensão especulativo), e o rodapé ganhou `nada a anexar` um passo antes do previsto, porque `0 de 3 · ~0 tok` é certo e inútil. ⚠️ **Desperdício medido, e é de processo:** editei o componente antes do chamador passar as props novas, e o `test_related` rodou ~5 vezes contra uma árvore pela metade — cada disparo é a suíte relacionada inteira (~40 s) e um dump de DOM enorme. Nenhum provou nada. Chamador e chamado passam a ir na mesma leva |
| 10/09/2026 | Passo 2: o orçamento atravessa, e há uma conta só | ⚠️ **A ausência da guarda contra laço NÃO produz teste vermelho — mata o worker do Vitest** (`Worker exited unexpectedly`, `Tests (10)` sem contagem de passou/falhou). É a forma que a skill `testing` ensina a desconfiar, aqui produzida por um defeito real e não por sintaxe quebrada: escalada para o [`ARMADILHAS.md`](../../ARMADILHAS.md). E a **primeira** tentativa de sabotagem foi mascarada por outro portão — remover a comparação deixou `sameBudget` sem uso e o `typecheck` reprovou antes de qualquer teste rodar; sabotagem que muda a superfície de tipo prova o compilador, não o teste |
| 10/09/2026 | Passo 3: `Anexar`, o pendente e o envio | Um `?? ''` para `libraryId` foi escrito e trocado por recusa explícita: o schema é `min(1)`, então a queda apareceria como erro de zod no `conversation:append`, longe da causa. Dois achados de harness: `ConversationView` **não** carrega a lista de conversas (o `mount` ganhou um nó extra em vez de mudar o harness dos 11 testes existentes), e chamar `api.conversation.create` direto **não invalida a query da lista** — trocar de conversa num teste tem de passar pelo `create` do provider, que é quem seleciona o que cria. Vermelho provado no ponto mais sutil: sem o carimbo, a consulta segue o usuário para a outra conversa. `check:fast`: **155 arquivos / 1506 testes, 143,43 s** |
| 10/09/2026 | Passo 4: verificação ao vivo pelo dono, e a conclusão errada que quase foi registrada | Os dez pontos conferidos. **O item 8 é o mais forte do arco até aqui:** o raciocínio do `qwen3.5:2b` cita a documentação *e a versão fixada* — *"In the TanStack Query client v5.60.5, both clear() methods exist"* —, e `v5.60.5` só existe no cabeçalho que o `formatDocsCard` monta. ⚠️ **O item 5 do roteiro estava mal dimensionado** (meu erro): 741 tok numa janela de 4.096 cabe com folga, então ele nunca ia mostrar o `não cabe`; o caso está coberto pelo item 3 e por teste de nível 2. ⚠️ **E uma conclusão errada quase entrou na errata:** `codeTokens` 293 contra `prompt_eval_count` 160 parecia contagem inflada do Context7, e o segundo turno desmentiu (previsto ~1.168, medido **1.200**). Era cache de prefixo do Ollama — escalado para o [`ARMADILHAS.md`](../../ARMADILHAS.md). Achado de produto que vira pendência: o **título** do trecho também é markdown, e sai cru ([`ROADMAP § 4`](../../ROADMAP.md)) |
