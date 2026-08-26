# F-3-B — Como se chega ao painel: clipe no cabeçalho, seletor de anexos e atalho

> Segundo dos quatro planos do painel de artefato, depois do [F-3-A](../implemented/F-3-A-painel-de-artefato.md). Este cobre **as três formas de abrir e trocar** o que o painel mostra; o comportamento do painel como objeto de desktop (arrasto, janela estreita, transição) é do F-3-C, e o dataset do F-3-D.

**Origem:** pedido do usuário (26/08/2026) durante a revisão do F-3-A — um ícone de clipe com a contagem de anexos no cabeçalho da conversa, do lado oposto ao título, que abre o painel e some quando não há anexo. Junta-se ao que o F-3-A já tinha deixado marcado para cá: seletor de anexos no cabeçalho do painel e atalho de teclado.

**Entrega:** `ConversationView` dividido (é o plano que o toca, e ele está acima do teto); um clipe contador no cabeçalho da conversa; um seletor de anexos no cabeçalho do painel; `Ctrl+B` alternando o painel. Nenhum canal IPC novo — tudo se lê da transcrição que o renderer já tem.

---

## ⚠️ O corte do F-3 passa de três planos para quatro

O F-3-A previa `A / B / C`. Com o clipe entrando, o B ficaria com **seis** passos commitáveis — exatamente o tamanho que o plano 19 mediu como caro demais (sete passos num arquivo só, 950k tokens, defeitos que só o teste ao vivo pegou). A lição está registrada e é explícita: **preferir arquivo de plano separado a passo dentro de um arquivo.**

| | Entrega | Estado |
|---|---|---|
| **F-3-A** | A região, o estado, documento e imagem | ✅ concluído 26/08/2026 |
| **F-3-B** (este) | Como se chega ao painel: clipe, seletor, atalho | — |
| **F-3-C** | O painel como objeto de desktop: arrasto, janela estreita, transição, e a decisão de copiar imagem | — |
| **F-3-D** | Dataset entra no painel | — |

**Custo assumido:** o "F-3-C = dataset" já estava escrito em quatro lugares (`ROADMAP § 1`, o plano F-3-A, o marco no `HISTORY.md`, e o `DECISOES.md`). Os quatro se corrigem no passo 1, e a 11ª invariante do `guard` recusa o commit se algum link ficar para trás. É barato **porque** nenhum dos arquivos F-3-C/D existe ainda — é o mesmo argumento que a renumeração de ago/2026 usou, e o inverso do que barrou renumerar o arco 21–23, cujas siglas já vivem dentro de um `.ts`.

---

## O que foi checado contra o código real antes de virar plano

| Afirmação plausível | O que existe de fato |
|---|---|
| O contador precisa de um canal ou de estado novo | Não. `attachmentPartOf(message)` já existe em `core/ai/messages.ts:39` e é o que o `ConversationView` usa para desenhar o cartão. Contar é um `filter` sobre a transcrição que o renderer já tem em mãos |
| Dá para acrescentar o clipe ao cabeçalho e seguir | `ConversationView.tsx` está em **407 linhas** contra um teto de 400. Já estava estourado quando o F-3-A o deixou intocado de propósito; a régua diz *"divide-se ao tocar"*, e este é o plano que toca |
| O atalho pode ser um `globalShortcut` | **Errado, e ativamente.** `globalShortcut` dispara **mesmo com o app sem foco** (doc do Electron, confirmada via Context7 em 26/08/2026) — `Ctrl+B` seria sequestrado do sistema inteiro |
| Então é acelerador de item de menu | Local shortcut do Electron **exige um `MenuItem`**, e este app **não constrói menu nenhum** (`grep` por `setApplicationMenu`/`Menu.` em `src/main/`: zero ocorrências). Seria criar um menu de aplicação para hospedar um atalho |
| `before-input-event` no main, então | Funciona, mas põe no processo privilegiado a decisão sobre um estado que **mora no renderer** (`ArtifactProvider`), e cobra um salto de IPC por tecla. Ver DF3B.3 |
| Mover a lista de mensagens para um componente é mecânico | ⚠️ Não: o `div` que rola é medido por ref pelo `useStickToBottom`, e o comentário no fonte avisa que **trocar o elemento faz o hook observar o nó errado**. A extração tem de levar o ref junto, e é o que o passo 1 precisa provar |
| O painel já sabe listar os anexos da conversa | Não. O `ArtifactProvider` guarda **um** `ArtifactRef`, o que estiver aberto — ele não conhece a transcrição. O seletor lê as mensagens, como o cabeçalho da conversa vai ler |

---

## Decisões

### DF3B.1 — O clipe abre o anexo mais recente, e fecha se já estiver aberto

Um clique tem de chegar a conteúdo. Abrir uma lista para depois escolher são dois cliques para o caso que domina — a conversa com **um** anexo.

Então: o clipe alterna o painel sobre o **último** anexo da conversa. Com o painel já aberto, ele fecha — mesma regra dos cartões (DF3A.6), e o botão é um *toggle* de verdade, com `aria-pressed`, não `aria-current` (que é do cartão, e significa outra coisa: "sou o item exibido").

Quem tem mais de um anexo troca pelo seletor do cabeçalho do painel, que é a outra metade deste plano. É por isso que os dois vêm juntos e não em planos diferentes.

### DF3B.2 — Sem anexo, sem ícone — e a contagem mora em `core/`

Botão desabilitado promete uma capacidade que a conversa não tem; ausência é honesta e some sem ruído. Decisão do usuário, e coincide com o que o F-3-A já fez com o copiar de imagem.

A função que conta é pura, recebe `Message[]`, e vive em `core/ai/messages.ts` ao lado do `attachmentPartOf` que ela usa — nível 1, testável sem montar nada. No componente ela viraria lógica escondida atrás de JSX, no lugar mais caro de testar.

**Conta cartões, não arquivos distintos.** Dois anexos do mesmo arquivo contam dois, porque são dois cartões na transcrição e o número existe para descrever o que se vê.

### DF3B.3 — O atalho é ouvido no **renderer**, e as três alternativas do Electron são recusadas com motivo

| Rota | Por que não |
|---|---|
| `globalShortcut` | dispara com o app **sem foco** — sequestraria `Ctrl+B` do sistema |
| Acelerador de `MenuItem` | exige um menu de aplicação, que este app não tem; seria construir um menu para hospedar um atalho |
| `before-input-event` no main | funciona, mas decide no processo privilegiado sobre estado que mora no renderer, e cobra um salto de IPC por tecla |

Sobra o ouvinte de `keydown` no renderer — a rota que a própria doc do Electron lista primeiro para tecla que a janela trata sozinha. O estado é do `ArtifactProvider`; o ouvinte fica ao lado dele.

⚠️ **Ele não pode roubar a tecla de dentro do composer.** O `textarea` é onde o usuário digita, e um atalho que dispara no meio de uma frase é pior que atalho nenhum — a verificação de alvo faz parte do passo, não é polimento.

### DF3B.4 — `Ctrl+B` para o painel, invertendo o VS Code de propósito

O padrão de mercado é o VS Code: `Ctrl+B` alterna a lateral **esquerda**, `Ctrl+Alt+B` a **secundária, à direita** — o análogo exato deste painel.

Invertemos, com motivo: no VS Code a lateral esquerda é a que se alterna o tempo todo; aqui a sidebar é uma lista de conversas que se deixa aberta, e o painel é o que abre e fecha a cada anexo. **O acorde fácil vai para a ação frequente.** Se a sidebar ganhar atalho um dia, ela leva o `Ctrl+Alt+B`, não o contrário.

Dois motivos práticos a favor: `Ctrl+B` está livre (o composer é `textarea` puro, sem negrito para colidir) e `Ctrl+Alt` em teclado ABNT2 **é** o AltGr — funciona, mas é uma classe de armadilha que não vale estrear num atalho primário. ⚠️ **Isso é para verificar ao vivo, não para afirmar daqui.**

`Esc` já fecha desde o F-3-A e não muda.

### DF3B.5 — O seletor lista os artefatos **da conversa atual**, na ordem em que apareceram

Ele responde uma pergunta concreta: com o painel aberto e o cartão vinte mensagens acima, como se troca de anexo? É também o que transforma o painel de *"o que eu cliquei"* em *"o que esta conversa tem"*.

Forma: o cabeçalho do painel deixa de ser um título estático (o F-3-A o deixou assim de propósito, recusando construir gatilho antes de ter consumidor) e passa a ser o gatilho de um `Popover` — o primitivo nativo que o projeto já usa, com `anchorName` vindo de `toAnchorName(useId())`. Item marcado é o aberto.

⚠️ **Sob jsdom, todo conteúdo de `Popover` computa `display:none`** — a folha padrão do próprio jsdom traz `[popover]:not(:popover-open) { display:none }`, que o shim não alcança. Consulta de nível 2 precisa de `{ hidden: true }`, como os outros consumidores já fazem.

### DF3B.6 — `ConversationView` se divide por coesão, não para caber

Dividir só até passar de 400 produziria um corte arbitrário que a próxima linha desfaz. O corte que o arquivo pede é a **transcrição**: a lista, a escolha entre bolha de usuário e resposta do assistente, o despacho de cartão de anexo e de proposta de passos, e a superfície que rola. O que fica é orquestração — disponibilidade do serviço, estado do chat, composer, e agora o cabeçalho com o clipe.

⚠️ **O ref do `useStickToBottom` viaja com o `div` que rola.** O fonte avisa: trocar o elemento faz o hook observar o nó errado. Um teste de rolagem que passa não prova isso — o teto do plano 19 é a lembrança de que jsdom não tem layout. O que prova é o e2e do F-3-A continuar verde mais uma verificação ao vivo com a thread rolada.

---

## Passos

### 1. O corte vira quatro planos

`ROADMAP § 1`, `HISTORY.md`, `DECISOES.md` e o plano F-3-A passam a dizer **F-3-C = desktop** e **F-3-D = dataset**. Commit isolado; a 11ª invariante do `guard` é a rede.

### 2. `ConversationView` se divide (DF3B.6)

A transcrição sai para componente próprio, com o ref do `useStickToBottom` junto. Zero mudança de comportamento — as 62 asserções de `ConversationView.test.tsx` e `modelSelection.test.tsx` são o contrato, e nenhuma delas deve precisar mudar. Se alguma precisar, a extração passou do ponto.

### 3. O clipe contador no cabeçalho (DF3B.1, DF3B.2)

`countAttachments` em `core/ai/messages.ts` com teste de nível 1; o botão no cabeçalho, `ml-auto`, densidade de chrome, `Paperclip` + número, `aria-pressed`, ausente com zero. Nível 2: aparece com anexo, some sem, abre o mais recente, fecha se já aberto.

### 4. O seletor de anexos no cabeçalho do painel (DF3B.5)

O título vira gatilho de `Popover`. Nível 2 com `{ hidden: true }`. Entra aqui o terceiro estado vazio que o F-3-A deixou pendente por ser inalcançável — conversa sem anexo —, que o seletor **continua** não tornando alcançável, já que sem anexo não há clipe nem cartão: registrar isso e **não** escrever a tela.

### 5. `Ctrl+B` (DF3B.3, DF3B.4)

Ouvinte no renderer, ao lado do `ArtifactProvider`, ignorando evento originado em campo de texto.

### 6. Prova ao vivo

`pnpm dev` e o e2e. O que só a tela responde: `Ctrl+B` num teclado ABNT2 de verdade; o clipe no cabeçalho sem empurrar o título (que já trunca); a rolagem da thread sobrevivendo à extração do passo 2; contraste e quebra dos dois controles novos — defeito recorrente registrado, e jsdom não pega.

---

## Verificação

- `pnpm check:fast` depois de cada passo.
- `e2e/dev/artifact-panel.spec.ts` verde ao final, mais um caso para o clipe.
- Nível 1 para a contagem, nível 2 para clipe, seletor e atalho. **Não cobrem** o teclado físico, o contraste nem a rolagem depois da extração.

---

## Fora do escopo deste plano

| | Onde vai |
|---|---|
| Arrasto e limites de largura, janela estreita (a conversa em 271px), transição de abertura | `F-3-C` |
| Copiar imagem — `corsEnabled` contra um canal `image:bytes` (recomendado) | `F-3-C` |
| Dataset no painel, e a pergunta da paginação | `F-3-D` |
| Código e gráfico como artefato | fora do F-3 inteiro |

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 26/08/2026 | — | plano escrito, ainda não executado | Escrito na mesma sessão do F-3-A, lendo o código dele. Context7 (`electron`) decidiu a DF3B.3: `globalShortcut` dispara sem foco, e o acelerador local exige um `MenuItem` que este app não tem — `grep` confirmou zero `setApplicationMenu` em `src/main/`. O corte passou de três planos para quatro na escrita, ao contar seis passos no B. |
