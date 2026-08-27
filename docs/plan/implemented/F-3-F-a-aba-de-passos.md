# F-3-F — A aba Passos: a bolha vira linha, e o pipeline ganha lugar

> Último plano do painel de artefato, depois do [F-3-A](F-3-A-painel-de-artefato.md), [F-3-B](F-3-B-como-se-chega-ao-painel.md), [F-3-C](F-3-C-o-painel-como-objeto-de-desktop.md), [F-3-D](F-3-D-o-dataset-no-painel.md) e [F-3-E](F-3-E-copiar-imagem.md). Fecha o corte.

**Origem:** a **DF3D.9** adiou esta aba com um motivo nomeado — a proposta é uma **mensagem**, mas "o pipeline aplicado a este dataset" não existia como estado. O usuário decidiu o recorte em 27/08: o cartão da conversa vira uma **linha** que abre o painel; passo se **desliga** em vez de ser removido; apagar a proposta no painel apaga a linha na conversa; e `Aplicar` vira **`Ver resultado`**.

**Entrega:** a quarta aba do dataset, a lista de passos com liga/desliga, o antes-e-depois em destaque, e `StepProposalCard` (210 linhas na bolha) reduzido a uma linha na transcrição. Nenhum canal IPC novo.

---

## O que foi checado contra o código real antes de virar plano

| Afirmação plausível | O que existe de fato |
|---|---|
| A proposta pode simplesmente sumir da conversa | ⚠️ **Não.** Ela **é** a resposta do modelo: `useStepProposal` faz `append` de uma mensagem `assistant` com uma parte `stepProposal`, persistida em SQLite. Não renderizá-la deixaria a mensagem viva no banco, reenviada ao modelo no contexto, e invisível na tela |
| `Aplicar` grava alguma coisa | **Não grava nada.** `dataset:transform` devolve uma prévia de `TRANSFORM_PREVIEW_ROWS` (200) linhas mais os perfis de antes e depois. O arquivo original nunca é tocado — anexo é endereçado por conteúdo (D16.3). O nome do botão promete o que não acontece |
| O antes/depois não existe ainda | **Existe e é descartado.** `dataset:transform` já devolve `before`/`after`, e o cartão usa **só** para o alarme de nulos: a variação de linhas e de colunas é calculada e jogada fora |
| Cada passo é um interruptor | ⚠️ A APG diz o contrário para este caso: *"a switch is often more intuitive for binary actions… while a **checkbox may be more appropriate for items within a list of options**"*. São itens numa lista, então **caixa de marcação**, não o primitivo `Switch` |
| `proposalKind` distingue os dois verbos da D9.4 | ⚠️ **É gravado e nunca lido.** `useStepProposal` grava `'query'` ou `'steps'`, e nenhum componente consulta — as duas caem no mesmo `dataset:transform`. Gap real, **fora deste plano** (ver o fim) |
| Uma conversa tem uma proposta por dataset | Não há nada que garanta isso. Iterar produz várias, todas para o mesmo `hash` |

---

## Decisões

### DF3F.1 — A proposta continua sendo mensagem; o cartão vira linha

"Deixar de existir" tem três leituras, e duas quebram:

| | Consequência |
|---|---|
| O cartão some da conversa | Buraco na transcrição: você pergunta e **nada responde**. Ao reabrir amanhã, parece que o modelo ignorou |
| A proposta deixa de ser gravada | Some ao fechar o app, sem aviso |
| **O cartão vira linha** | ✅ A conversa segue verdadeira; o trabalho vai para o painel |

A linha é o mesmo formato que `DocumentCard` e `DatasetCard` já tomaram (DF3A.6): um gatilho, com a seta apontando para a direita.

### DF3F.2 — A aba mostra **uma** proposta: a que você abriu

Uma conversa pode ter várias propostas para o mesmo dataset. A aba mostra **uma**, e quem escolhe é a linha clicada; abrir a aba direto mostra a mais recente.

**A conversa é o índice.** Nenhum controle de navegação dentro da aba — as linhas na transcrição já estão em ordem cronológica e já dizem qual é qual. Um seletor dentro da aba duplicaria isso e poderia discordar dele, que é o erro que a DF3B.5 já corrigiu uma vez.

⚠️ **Caso de borda:** a mensagem do dataset pode ter sido apagada e a da proposta não. Sem o `DatasetPart` não há artefato para abrir — a linha então **não** é clicável, em vez de abrir um painel vazio.

### DF3F.3 — Passo se desliga; a proposta se apaga

Duas destruições muito diferentes, hoje tratadas igual:

| Ação | Hoje | Passa a ser |
|---|---|---|
| Tirar um passo | some da lista, sem volta | **desliga** — continua visível, apagado, e religa com um clique |
| Apagar a proposta | lixeira + confirmação | igual, e a lixeira vive no painel |

Desligar em vez de apagar é o comportamento do [OpenRefine](https://guides.library.illinois.edu/openrefine/undoredo), onde passo desfeito fica cinza na lista e clicar nele o traz de volta. O ganho concreto: a proposta **original do modelo** nunca se perde, e experimentar não custa nada.

O `Ver resultado` compila só os passos ligados. Uma proposta com todos desligados desabilita o botão, como hoje com a lista vazia.

### DF3F.4 — `Ver resultado`, não `Aplicar`

O botão promete o que não acontece: nada é gravado, e o que aparece é uma amostra de 200 linhas. Salvar de verdade é da **trilha E**, e é lá que vai existir um botão que salva — dois botões parecendo a mesma coisa é pior que um nome ruim.

### DF3F.5 — O antes-e-depois sobe para o topo, e isso **não** contradiz a D19.6

`8.412 → 1.240 linhas · 12 → 11 colunas`, em destaque, acima da tabela.

A D19.6 decidiu **não alarmar** com contagem de linhas — zero linhas depois de um filtro costuma ser o resultado certo, e um alarme ali vira ruído que se aprende a ignorar. **Mostrar não é alarmar.** O alarme continua sendo só o salto de nulos, em `warn`, e continua com o limiar de 10 pontos.

### DF3F.6 — Apagar no painel apaga a linha na conversa

É a mesma coisa em dois lugares: `conversation:removeMessage`, que já existe e já é persistido. A confirmação fica, porque esta é a **única** ação irreversível da aba — desligar passo não é.

### DF3F.7 — O estado dos passos vive em `ArtifactDataset`

Quais passos estão ligados e o último resultado sobrevivem a **trocar de aba** — sem isso, ir ao Dados comparar e voltar apagaria tudo, que é justamente o gesto que a aba existe para permitir.

Morrem ao fechar o painel, como o SQL digitado (DF3D.8): mesma regra, uma só, dita em voz alta em vez de descoberta.

### DF3F.8 — Caixa de marcação, não `Switch`

A APG é explícita para este caso, e o projeto tem o primitivo errado à mão. Um `Switch` numa lista de itens diz "ligar um aparelho"; o que a lista faz é escolher quais itens entram.

Não nasce um oitavo primitivo por isso — a régua é dois chamadores (DF3D.2), e este é um.

---

## Passos

### 1. A aba Passos existe e mostra a proposta (DF3F.2, DF3F.7)

Quarta aba em `ArtifactDataset`, com as propostas do dataset derivadas das mensagens — do mesmo jeito que `artifactsOf` deriva os artefatos, e pelo mesmo motivo: duas derivações em lugares diferentes é como o número de uma e o comprimento da outra começam a discordar.

Nível 2: mostra a mais recente ao abrir a aba direto; mostra a escolhida quando há uma; diz que não há proposta quando não há.

### 2. Ligar, desligar, e ver o resultado (DF3F.3, DF3F.4, DF3F.5)

A lista com caixas de marcação, o `Ver resultado` compilando só os ligados, o antes-e-depois em destaque e o aviso de nulos.

Nível 2: desligar um passo tira ele da chamada e **não** o tira da lista; religar o traz de volta; tudo desligado desabilita o botão; o resumo traz as duas contagens; o aviso aparece só acima do limiar.

### 3. A lixeira no painel (DF3F.6)

Move o diálogo de confirmação que já existe. Nível 2: confirmar chama `removeMessage` com a conversa e a mensagem certas; cancelar não chama nada.

### 4. A bolha vira linha (DF3F.1)

`StepProposalCard` (210 linhas) vira `StepProposalLine`. A suíte dele se parte: o que testava a lista e o `Aplicar` já migrou para os passos 2 e 3; o que sobra é "abre o painel com a proposta certa" e "não é clicável quando o dataset sumiu".

⚠️ **A ordem 1-3 antes do 4 é deliberada**, pela lição do F-3-D: o painel ganha tudo antes de a bolha perder qualquer coisa. Entre os passos as duas superfícies coexistem, e isso é preferível a um commit em que não há como rodar passo nenhum.

### 5. Prova ao vivo

Curta, e é do usuário: pedir uma proposta de verdade, desligar um passo, ver o resultado mudar, religar, e apagar a proposta conferindo que a linha some da conversa.

---

## Verificação

- `pnpm check:fast` depois de cada passo.
- Provocação obrigatória, **uma sabotagem por vez**: compilar todos os passos em vez de só os ligados; deixar de apagar a mensagem ao confirmar a lixeira; mostrar a proposta mais recente quando outra foi escolhida.
- **Sem caso E2E novo.** O `artifact-panel.spec.ts` já prova que as abas trocam em Chromium real; o que este plano acrescenta é decisão, e decisão se prova no nível 2.

---

## Fora do escopo deste plano

| | Onde vai |
|---|---|
| ⚠️ **`proposalKind` gravado e nunca lido** — `useStepProposal` distingue `'query'` de `'steps'` (os dois verbos da D9.4) e nenhum componente consulta; as duas caem no mesmo `dataset:transform`. Corrigir exige decidir o que uma proposta de **consulta** deveria fazer diferente, e isso é pergunta de produto, não de layout | plano próprio, sem arquivo |
| Salvar o resultado como arquivo | trilha **E** |
| Reordenar passos, ou escrever um passo à mão | não entra — a D19 já registra "construção manual de passo" como fora |
| Empilhar propostas na mesma aba | não entra (DF3F.2) — a conversa é o índice |
| O pipeline **persistido** por dataset, sobrevivendo ao reinício | não entra: exigiria tabela nova e migração, e ninguém pediu |

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 27/08/2026 | 1-5 | **plano concluído** | Os passos 1-3 saíram num commit só: a lixeira já vinha escrita no componente, e separá-la seria um commit só de teste. **Duas falhas silenciosas achadas no CSS construído**, nenhuma visível no fonte: `accent-accent` não gerava regra (cor precisa de `@utility`) e `size-4` são 8px, porque a escala numérica é a do projeto — armadilha nova, registrada. **Conservação pegou um erro do F-3-D de carona:** três comentários citavam `DatasetPreview`, apagado lá e não corrigido na hora. `check:fast`: 912 testes, 105 arquivos. |
| 27/08/2026 | — | plano escrito, ainda não executado | Recorte decidido com o usuário em quatro perguntas, todas respondidas por ele. A pesquisa (Context7 + web) mudou **duas** coisas antes de existir código: o OpenRefine deu o precedente para desligar-em-vez-de-apagar (passo desfeito fica cinza, religa com um clique), e a APG contradisse a sugestão original de usar o primitivo `Switch` — item numa lista pede caixa de marcação. Achados no código: `dataset:transform` **não grava nada** (o que condenou o nome `Aplicar`), o antes/depois já é calculado e descartado, e `proposalKind` é gravado e nunca lido. |

**O que este plano deixou fora dele** — escalonado na conclusão:

| Achado | Dono |
|---|---|
| `size-4` são 8px: a escala numérica é a do projeto, não a grade de 4px do Tailwind | [`ARMADILHAS.md`](../../ARMADILHAS.md) (88 entradas) |
| Propriedade de cor precisa do próprio `@utility`, senão não gera regra | skill [`design-system`](../../../.claude/skills/design-system/SKILL.md) |
| Os consumidores de `DatasetTable`/`formatCell` mudaram de nome duas vezes; a skill agora descreve o papel, não o arquivo | skill [`data`](../../../.claude/skills/data/SKILL.md) |
| Decisões DF3F.1–DF3F.8 | [`DECISOES.md`](../../DECISOES.md) |

✅ **Aceite observado pelo usuário em 27/08/2026.** Proposta real pedida ao `qwen2.5-coder:3b`, linha aberta pelo clique, `Ver resultado` rodado, e a exclusão conferida — a linha some da conversa junto com a proposta (DF3F.6). O antes-e-depois apareceu como `15 → 11 linhas · 5 → 5 colunas`, e o alinhamento numérico saiu certo por coluna sem configuração nenhuma (DF3D.5).

⚠️ **Um comportamento a vigiar, visto na mesma passagem:** o aviso de nulos ficou calado, corretamente — o `salario` já tinha vazios, e o filtro apenas os concentrou. Mas **concentrar pode cruzar o limiar de 10 pontos sem que o passo tenha causado dano**, e aí o alarme seria falso. Num arquivo maior isso aparece. O conserto, se aparecer, é comparar proporção esperada em vez de percentual bruto — não mexer no limiar.
