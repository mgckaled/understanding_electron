# 23-H — a conversa

> Oitavo corte do arco 23. Material de entrada: [`docs/reference/context7/`](../../reference/context7/README.md) e os sete diários dos cortes já implementados. Siglas nascem como `D23H.n`.

## Contexto

O arco 23 entregou sete cortes: o cliente REST, a fronteira, a parte persistida, o painel, a desambiguação, o resultado e — no 23-G — a seleção com `Anexar`. Hoje uma consulta ao Context7 **chega ao modelo e não aparece na transcrição**: `docsPartOf` existe em `core/ai/messages.ts` desde o 23-C e não tem um único consumidor no renderer. O `formatDocsCard` entra no prompt, o medidor conta, e na tela não há sinal de que algo foi consultado.

Este corte fecha essa lacuna e liga a única promessa do arco que ainda está inteira no papel: **DM-31 — consultas acumulam, e cada uma pode ser desligada do reenvio sem sair da transcrição.** O canal `conversation:setDocsEnabled` existe desde o 23-C, o filtro em `partForProvider` também, e nenhum dos dois tem quem os acione.

Entregas, na ordem em que serão construídas:

1. a **linha retrátil** na transcrição, com o interruptor e o rótulo `fora do contexto`;
2. a **releitura** de uma consulta já anexada dentro do painel;
3. o **contador** no cabeçalho da conversa — o terceiro, nunca somado aos outros dois;
4. o **`histórico ▾`** no cabeçalho do painel: navegação, total das ativas e controle.

Decisões de origem: DM-23 (tipo próprio, divulgação retrátil), DM-31 (acumula, com desligar) e DM-32 (ícone), com o desenho em [`painel.md`](../../reference/context7/painel.md).

⚠️ **Corte único por decisão do dono**, ciente de que o guia autoriza dois irmãos. A ressalva do plano 19 (sessão longa cobra caro) vale: os cinco passos são commitáveis em separado, e o passo 5 é fase, não opcional.

---

## O que já está pronto e não se reconstrói

Levantado lendo o código, não suposto.

| Peça | Estado | Consequência para este corte |
|---|---|---|
| `docsPartOf(message)` (`core/ai/messages.ts`) | existe, **sem consumidor** | o despacho é uma linha em `MessageList`, não um `switch` novo |
| `partForProvider` case `'docs'` | já devolve `''` quando `enabled` é falso | **o reenvio filtrado já funciona** — nenhuma linha nova, e o medidor do composer já concorda por construção |
| `conversation:setDocsEnabled` | canal, schema, preload e handler prontos (23-C) | falta só a mutação no renderer |
| `DocsPart` (`shared/ipc.ts`) | carrega `snippets`, `notes`, `omitted`, `rules`, `enabled` | a releitura tem tudo de que precisa, sem canal novo |
| `DocsSnippetList` | já aceita `frozen` | a releitura reusa, não recria |
| `Switch`, `Popover`, `Tabs`, `SidePanel`, `Button` | primitivos | nada de design system nasce aqui |
| A parte viaja na mensagem do **usuário** | `useConversationChat.ts` | a linha renderiza no ramo do usuário de `MessageList`, acima do cartão de anexo e da bolha |

---

## Decisões a fixar

**D23H.1 — o desligar mora nos dois lugares, com um dono só.** O `Switch` fica no cabeçalho da linha retrátil (onde o efeito aparece, ao lado de `fora do contexto`) **e** em cada linha do `histórico ▾` (onde o total das ativas é lido). A objeção de "dois pontos de sincronia" não se sustenta, e é por isso que a decisão fica registrada: **nenhum dos dois guarda estado** — os dois chamam a mesma mutação e leem o mesmo `DocsPart.enabled` do cache do TanStack Query. Ler `1.204 tok ativos` e ter de sair dali para mudar é a divisão que custaria de verdade.

**D23H.2 — `DocsLine` mora em `features/docs/`.** O assunto é documentação, e importação entre `features/` é livre. `MessageList` já importa de `features/attachment/` e `features/draft/` pelo mesmo motivo.

**D23H.3 — três irmãos num contêiner flex, nunca botão dentro de botão.** Confirmado contra a fonte (WAI-ARIA APG, MDN `button` role): elemento interativo dentro de um `role="button"` tem a semântica removida, e o React não avisa. O retrátil (`<button aria-expanded aria-controls>`), o `Switch` (`role="switch"`) e o `⧉` são irmãos; só o primeiro é o alvo de clique do retrátil.

**D23H.4 — o contador usa `aria-pressed`, como os dois irmãos.** A pesquisa aponta o contrário: para um botão que mostra e esconde um painel, `aria-expanded` é o atributo certo, e `aria-pressed` descreve estado binário de recurso. `ArtifactCount` e `DraftCount` usam `aria-pressed` com comentário justificando contra `aria-current`, que era a comparação errada. **Um terceiro contador divergindo sozinho é pior que três consistentes:** o corte segue o irmão, e a troca dos três vira pendência do 23-K com esta procedência registrada.

**D23H.5 — a releitura é componente próprio, não um modo do `DocsResult`.** `DocsResult` carrega seleção, `freeze`, `attach` e o rodapé com veredito — nada disso existe numa consulta congelada. Nasce `DocsAttached.tsx`; `NoteList` e `RuleList` **sobem** de `DocsResult.tsx` para `DocsLists.tsx`, que é a régua dos dois chamadores disparando de verdade e não por antecipação.

**D23H.6 — o omitido aparece como título e custo, nunca como código.** É D23C.3 sendo estrutural e não estilo: a parte **não guarda** o código do que ficou de fora.

**D23H.9 — acrescentada em execução: na releitura, o omitido ganha aba própria.** O plano não dizia onde ele ia. Misturá-lo à aba Trechos mentiria sobre o que foi enviado, e um rodapé com N títulos fica ilegível. A aba `Não enviados (N)` aparece **só quando há omitido**, que é a mesma regra de Regras (D23F.7) — e o rodapé fica com uma linha só, `N de M · ~X tok`, mais o único fato que ele acrescenta ao rodapé de composição: se a consulta ainda está no contexto.

**D23H.7 — invalidação simples, sem atualização otimista.** O `invalidate` de `['conversations']` já cobre `['conversations', id, 'messages']` por prefixo, e a escrita é um `json_set` num SQLite local. O padrão `onMutate` + snapshot + rollback em `onError` (confirmado na documentação do TanStack Query 5) fica **registrado como o conserto** se o piscar aparecer na verificação ao vivo — uma variável por vez.

**D23H.8 — os dois totais na tela medem coisas diferentes de propósito.** O do `histórico` é em **tokens exatos** (a API conta cada trecho); o do composer é em **chars estimados** pelo `charsPerToken`. O desenho avisava que eles "precisam concordar" — concordam no que importa, que é o **conjunto**: os dois derivam de `enabled`, um pelo `partForProvider` e o outro somando os mesmos itens. Não há segunda contagem escrita à mão.

---

## Os passos

### Passo 1 — a linha na conversa, e o desligar

Chamador e chamado na mesma leva — a lição medida no 23-G passo 1.

- `conversationsContext.ts` — `setDocsEnabled` no `ConversationsApi`, no molde exato de `removeMessage`: mesmo `scope`, mesmo `invalidate`.
- `features/docs/DocsLine.tsx` — novo. Molde de `ReasoningDisclosure.tsx` para o retrátil (`aria-expanded`/`aria-controls`, `h-[0px]` e nunca `h-0`, `[height:calc-size(auto,size)]`), fechada por padrão. Cabeçalho: ícone · `Context7 · <libraryId>` · `N trechos · ~M tok` · `⌄`, com o `Switch` irmão. Desligada, o subtítulo `fora do contexto`. Aberta: a pergunta entre aspas, os títulos enviados com custo, e os `omitted` com `— não enviado`.
- `MessageList.tsx` — `docsPartOf(message)` no ramo do usuário, acima do `AttachmentCard`.

⚠️ O título do trecho é markdown e sai cru (achado do 23-G, pendência do 23-K). **Não escrever um partidor de acento grave aqui.**

**Vermelho a provar:** desligar não muda a tela; e o retrátil abrir listando código em vez de títulos.

### Passo 2 — a releitura da consulta anexada

- `features/docs/DocsLists.tsx` — `NoteList` e `RuleList` saem de `DocsResult.tsx` sem mudança de comportamento.
- `features/docs/DocsAttached.tsx` — novo. As mesmas abas, `DocsSnippetList` com `frozen`, mais a lista de omitidos. Sem rodapé de veredito, sem `Anexar`, sem `Voltar`.
- `DocsProvider.tsx` / `docsContext.ts` — `viewing`, `view(part, trigger)` e `stopViewing()`, carimbados com `activeId` (D23D.2).
- `DocsPanel.tsx` — `viewing` tem precedência sobre as três telas atuais.
- `DocsLine.tsx` — o `⧉` ganha destino.

⚠️ `DocsPanel` devolve `null` e **nunca desmonta** (armadilha do 23-E). Teste de preservação nasce vacuoso aqui — não escrever.

**Vermelho a provar:** a releitura mostrando os omitidos como enviados; e o `viewing` de outra conversa vazando ao trocar de conversa.

### Passo 3 — o contador no cabeçalho

- `features/docs/DocsCount.tsx` — novo, molde literal de `ArtifactCount.tsx`: ausente quando zero (DF3B.2), `aria-pressed` (D23H.4). Um clique abre a **mais recente**.
- `ConversationView.tsx` — terceiro elemento no grupo `ml-auto`.

⚠️ **Conta todas, inclusive as desligadas.** Composição em andamento **não** conta.

**Vermelho a provar:** o contador somando só as ativas; e o contador aparecendo com zero consultas.

### Passo 4 — o `histórico ▾`

- `features/docs/DocsHistory.tsx` — novo. `Popover` com `toAnchorName(useId())`. Topo: soma **só das ativas**, em tokens exatos. Uma linha por consulta, com a pergunta como subtítulo — é o que distingue duas consultas da mesma biblioteca.
- `DocsPanel.tsx` — o gatilho no cabeçalho.

⚠️ O `+` do desenho **fica fora deste corte**: ele inicia uma composição nova sem voltar ao composer, e o gatilho do popover de anexos já faz isso.

**Vermelho a provar:** o total somando as desligadas; e o `Switch` do histórico não refletindo o da linha.

### Passo 5 — verificação ao vivo e fechamento

Fase, não opcional. Roteiro numerado, conferido pelo dono na tela.

| # | O que fazer | O que tem de acontecer |
|---|---|---|
| 1 | Consultar uma biblioteca, `Anexar`, mandar a mensagem | A linha aparece **acima** da bolha do usuário |
| 2 | Ler a linha fechada | `Context7 · /owner/repo` à esquerda, `N trechos · ~M tok` à direita |
| 3 | Clicar no cabeçalho da linha | Abre com a pergunta entre aspas, os títulos com custo, e **nenhum código** |
| 4 | Olhar o fim da lista aberta | O que ficou de fora aparece riscado, com `— não enviado` |
| 5 | Clicar no `⧉` da linha | O painel abre a consulta em leitura: abas, caixas marcadas e inertes, sem `Anexar` nem `Voltar`, e a aba `Não enviados` quando houver |
| 6 | Olhar o cabeçalho da conversa | O terceiro contador ao lado do clipe e do caderno. ⚠️ **Comparar as três silhuetas a 16px** — é a verificação de DM-32, possível pela primeira vez |
| 7 | Clicar no contador, e clicar de novo | Abre a mais recente; o segundo clique fecha |
| 8 | Abrir o `histórico` no cabeçalho do painel | Lista com a pergunta como subtítulo, e `N tok ativos` no topo |
| 9 | Desligar pelo interruptor da **linha** | Aparece `fora do contexto`, e o total do histórico cai na mesma hora |
| 10 | Desligar pelo interruptor do **histórico** | A linha da transcrição acompanha — é a prova de que a fonte é uma só |
| 11 | **Com a consulta desligada, mandar outra mensagem** | O `Prompt: N tokens` do rodapé cai perto do custo da consulta em relação ao turno anterior. ⚠️ Cuidado com o cache de prefixo do Ollama, que enganou o 23-G |
| 12 | Fechar e reabrir o app | A escolha de desligado sobreviveu |

Fechamento: `check:fast` remedido · errata devolvida aos três documentos do guia · conferência das sete skills · a régua das quatro derivas do [`CLAUDE.md`](../../../CLAUDE.md).

---

## Régua de tamanho a vigiar

| Arquivo | Antes | Risco |
|---|---|---|
| `DocsResult.tsx` | 249 | **encolhe** no passo 2 ao perder `NoteList`/`RuleList` |
| `DocsPanel.tsx` | 100 | cresce com a quarta tela e o gatilho do histórico |
| `DocsProvider.tsx` | 227 | cresce com `viewing` — coesão pesa antes do teto |
| `ConversationView.tsx` | 351 | uma linha, e já perto do teto de 400 |

---

## Fora do escopo

O `+` do cabeçalho do painel · os dez textos de erro e a exigência de chave (23-I) · o livro-razão, a pergunta enviada ao Context7 no Observatório e a variante inline do `MarkdownMessage` para o título do trecho (23-K) · `ESCOPO.md`, veredito formal de silhueta e guia antigo `⛔ consumido` (23-J) · trocar `aria-pressed` por `aria-expanded` nos três contadores (23-K, D23H.4).

---

## Como se verifica

| Peça | Nível | Forma |
|---|---|---|
| `setDocsEnabled` ponta a ponta | 2 | `test/store-api.ts` delega aos handlers reais sobre `:memory:` |
| linha retrátil, contador, histórico | 2 | jsdom; a classe é afirmável, a cor e o layout não |
| filtro do reenvio | 1 | conferir `core/ai/messages.test.ts`, e escrever se faltar |
| silhueta dos três ícones, piscar da invalidação | ao vivo | só o olho |

---

## Diário de execução

| Data | O que mudou | Observações |
|---|---|---|
| 12/09/2026 | Plano escrito a partir do guia do arco 23 e dos sete diários; D23H.1–D23H.8 fixadas | Três forquilhas resolvidas pelo dono: corte único (não dois irmãos), releitura da consulta anexada dentro do escopo, e o desligar como *navegação e controle* — que virou D23H.1. **Dois achados que encolhem o corte:** `partForProvider` já filtra a consulta desligada desde o 23-C (o reenvio não ganha uma linha), e `docsPartOf` existe sem consumidor desde o mesmo corte. Pesquisa externa: a APG confirma que interativo dentro de `role="button"` perde a semântica (D23H.3), e MDN aponta `aria-expanded` onde os dois contadores atuais usam `aria-pressed` — divergência registrada como pendência em vez de conserto solo (D23H.4) |
| 12/09/2026 | Passo 1: a linha na conversa, e o desligar | Chamador e chamado na mesma leva, como o 23-G ensinou. Vermelho provado duas vezes (interruptor gravando invertido; retrátil listando código). O `⧉` **não** foi renderizado aqui, ao contrário do que o plano sugeria: sem destino ele seria o botão falso que o próprio arco recusou no 23-A |
| 12/09/2026 | Passo 2: a releitura, e a extração que a régua dos dois chamadores cobrou | `DocsResult` caiu de **249 para 151** linhas ao perder `NoteList`/`RuleList`. D23H.9 acrescentada em execução: o omitido ganha aba própria. ⚠️ **O hook `test_related` pegou um erro que o `typecheck` não pegaria:** `viewing` referenciado no efeito acima da própria declaração — `ReferenceError` em runtime, mesma classe do achado do 23-C com os schemas de `shared/ipc.ts`. ⚠️ **E um teste meu nasceu vacuoso:** afirmar que o painel some ao trocar de conversa não distinguia carimbado de não carimbado, porque o painel some de qualquer jeito quando só há composição |
| 12/09/2026 | Passo 3: o contador, e a asserção vacuosa que deixou de ser | `toggle` passou a limpar a releitura (pedir consulta nova é pedir o formulário), e **isso mudou o que a ausência do painel prova**: `viewing` agora segura a região sozinho, então sem o carimbo o painel ficaria aberto sobre a outra conversa. A asserção por ausência voltou, e foi reprovada sob sabotagem antes de eu confiar nela. Dois vermelhos no contador. Achado de harness que o 23-G já tinha registrado e eu repeti: escrever pelo `api` direto **não invalida** a query, então o segundo turno precisou ser semeado antes do render |
| 12/09/2026 | Conferência do nível 1, e nada a escrever | O filtro do reenvio **já tinha teste** desde o 23-C (`messages.test.ts` § *a consultation that is switched off*), e mais completo do que o plano previa: além de o card sumir do prompt, ele afirma que `historyCharsOf` cai junto — que é exatamente D23H.8, escrita três cortes antes de eu a nomear. `check:fast` remedido: **156 arquivos / 1524 testes** (era 155/1506 no fecho do 23-G) |
| 12/09/2026 | Passo 5: verificação ao vivo pelo dono — dez dos doze pontos | Duas consultas reais (`/numpy/numpy · v2.3.1` e `/pandas-dev/pandas`). **A soma bate ao trecho:** 405+131+58+209+68 = **871**, o mesmo número na linha, no rodapé do painel e no histórico. ⚠️ **O item 11 é o mais forte:** `Prompt: 1.017` para uma consulta de 871 tok mais o cartão do dataset e o texto — a contagem exata do Context7 domina o prompt —, e o medidor previu **~2.419** para o turno seguinte, que é D23H.8 provada na tela em vez de argumentada. **Defeito que só o olho pega:** a linha do histórico dizia `5 · 1.637 tok` a um palmo da linha da transcrição dizendo `5 trechos` — consertado subindo `countsOf`/`costOf` para `summary.ts`, com os dois chamadores reais. Observação de produto, não defeito: o raciocínio do `qwen3.5:2b` diz *"I cannot see the actual file content"* — é o nível 1 (só esquema) fazendo exatamente o que o `ESCOPO` manda |
| 12/09/2026 | Passo 5 (2ª rodada): os dois pontos que faltavam, e um defeito que nenhum teste meu pegaria | Itens 6 e 12 conferidos: as três silhuetas a 16px são distintas (**DM-32 verificada**, três cortes depois de proposta), e o desligado sobreviveu ao reinício. ⚠️ **E o dono achou um defeito sério de layout que eu introduzi:** abrir o painel de documentação e depois o de rascunho desenhava **os dois ao mesmo tempo** — o de docs ia parar sobre a barra lateral. Causa de uma linha: no provider eu expunha `current: open ? current : null` e `viewing` **cru**, sem o mesmo portão, então o painel seguia se desenhando depois que outro inquilino tomara a região. É DE1B.1 violado, e o invariante que o `PanelProvider` torna inexpressável só vale para *quem ocupa*, não para *quem se desenha*. Teste escrito com outro inquilino chamando `raise`, e vermelho provado reintroduzindo o defeito exato |
| 12/09/2026 | Fechamento | Doze de doze pontos conferidos. Armadilha escalada na mesma sessão (dois painéis desenhados de uma vez), `ARMADILHAS.md` remedido de **113 para 114**. Errata devolvida ao guia: três premissas no `README.md`, e o 23-H marcado como entregue |
| 12/09/2026 | Passo 4: o `histórico ▾` | Dois vermelhos: o total somando as desligadas, e o interruptor endereçando outra consulta (prova que os dois interruptores leem a mesma fonte — D23H.1). ⚠️ **Duas asserções minhas eram inertes e o `typecheck` as pegou, não o teste:** `getByText` não aceita `hidden`, e um `toBeVisible` ficou sem os parênteses. Os testes passavam com as duas — `getByText` nunca filtrou por visibilidade, e matcher sem chamar não afirma nada. Só `getByRole` precisa de `hidden: true` dentro do `Popover` |
