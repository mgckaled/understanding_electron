# F-3-C — O painel como objeto de desktop: transição, janela estreita e arrasto

> Terceiro dos planos do painel de artefato, depois do [F-3-A](../implemented/F-3-A-painel-de-artefato.md) (a região, documento e imagem) e do [F-3-B](../implemented/F-3-B-como-se-chega-ao-painel.md) (clipe, seletor, atalho). Este cobre **como o painel se comporta como janela**: aparece, cede espaço e é redimensionável. Copiar imagem saiu para o F-3-E; dataset segue no F-3-D.

**Origem:** os três itens vêm das decisões que o usuário tomou ao fechar o F-3-A, registradas no [`ROADMAP § 3`](../../ROADMAP.md). A pesquisa desta sessão (Context7 + web) confirmou dois deles e **derrubou um risco** que estava aberto desde o F-3-A.

**Entrega:** o painel entra e sai com _fade_; a sidebar recolhe sozinha quando as três regiões não cabem; e o painel ganha uma alça de arrasto no padrão _window splitter_ da WAI-ARIA. Nenhum canal IPC novo — o plano inteiro vive em `renderer/` e na casca.

---

## O corte do F-3, atualizado

| | Entrega | Estado |
|---|---|---|
| **F-3-A** | A região, o estado, documento e imagem | ✅ 26/08/2026 |
| **F-3-B** | Como se chega ao painel: clipe, seletor, atalho | ✅ 26/08/2026 |
| **F-3-C** (este) | O painel como objeto de desktop | — |
| **F-3-D** | Dataset entra no painel | — |
| **F-3-E** | Copiar imagem pelo canal `image:bytes` | — |

**Por que copiar imagem saiu daqui.** Os três itens deste plano são renderer puro, e testam nos níveis 2 e 4. Copiar imagem é contrato IPC — toca `shared`, `main`, `preload` e o mock, e testa no **nível 3**. Raio de explosão diferente, camada diferente, nível de teste diferente; o único ponto de contato é a função `canCopy`, de quatro linhas. Juntar os dois é o erro do plano 19 outra vez.

---

## O que foi checado contra o código real antes de virar plano

| Afirmação plausível | O que existe de fato |
|---|---|
| Animar a largura reflui a thread e pode enganar o `useStickToBottom` | **O risco não existe.** O hook não tem ouvinte de `scroll` — de propósito, e o comentário no fonte explica por quê. `pinned` só é recalculado no efeito de `[contentSignal]`, comparando a posição real contra o fundo. Um reflow de largura não é lido como rolagem do usuário: no próximo token o hook se corrige sozinho |
| Uma animação de largura seria novidade arriscada no app | Não. `Sidebar.tsx:34` já tem `transition-[width] duration-(--duration-base) ease-initial` — recolher a sidebar **já anima 200ms e já reflui a thread**, em produção, desde a trilha DS |
| Fade de entrada e saída é só uma classe | ⚠️ Não. `@starting-style` só se aplica quando o elemento **entra** no DOM (MDN, explícito); para a saída é preciso **adiar a remoção**. O painel hoje faz `return null` — React desmonta e mata a saída |
| O painel pode recolher a sidebar | Não alcança. `Sidebar.tsx:37` guarda `collapsed` num `useState` **local**, e a regra D13.1 proíbe `app/` importar de `features/` |
| Recolher a sidebar já devolveria espaço ao painel | Hoje seria inútil: o teto do painel desconta `var(--sidebar-width)` (**264px**, a sidebar aberta) mesmo com ela recolhida (**44px**) — comentário deliberado em `ArtifactPanel.tsx`, correto até este plano |
| Existe algum arrasto no app para copiar | Zero. `grep` por `setPointerCapture`/`onPointerDown`/`col-resize` em `src/renderer/`: nenhuma ocorrência. A alça nasce do nada |
| A alça vira o oitavo primitivo | Não — a régua exige **dois** chamadores, e `Panel`/`Toolbar` já foram apagados por nascerem com um. Ela mora em `features/artifact/` |

---

## Decisões

### DF3C.1 — Fade, e o fechamento precisa de um estado a mais

Decidido pelo usuário ao fechar o F-3-A, com fundamento no [`ROADMAP § 3`](../../ROADMAP.md): a diretriz de movimento da Microsoft manda **fade** quando a UI é parte da superfície do app e o resto é **redimensionado** para acomodá-la. 200ms = `--duration-base`; `prefers-reduced-motion` já zera tudo em `base.css:161`.

O que a pesquisa acrescentou: a saída **não sai de graça**. `close()` passa a marcar `closing` no provider e só zera `current` quando o tempo passa; `toggle`/`togglePanel` cancelam um fechamento pendente. O fade mora num `ArtifactPanel.module.css`, pelo mesmo motivo que `Dialog` e `Popover` mantêm os deles: `@starting-style` precisa de uma regra, não de uma classe.

### DF3C.2 — O `collapsed` sobe para a casca, e o painel não conhece a sidebar

`collapsed` sai do `Sidebar.tsx` e passa a viver no `App.tsx`, que já compõe os dois. A sidebar vira controlada (`collapsed` + `onCollapsedChange`); o `collapsedRail` continua igual.

O painel **não** recebe referência à sidebar: ele avisa que abriu, por callback, e quem decide é a casca. É a forma de DIP que o projeto usa — parâmetro tipado, sem container — e mantém a direção da D13.1 intacta.

### DF3C.3 — Recolhe só na abertura, só quando não couber, e nunca reexpande

VS Code e Slack **não** recolhem sozinhos ao estreitar; mantêm a barra sob controle do usuário. A diferença aqui é que não é a janela que estreita — é o app que abre uma terceira região. A decisão do usuário fica, com três guardas para não virar briga:

1. recolhe **só** no momento em que o painel abre;
2. **só** quando as três regiões não couberem;
3. **nunca** reexpande sozinha — e se o usuário reexpandir na mão com o painel aberto, a regra se desliga até a próxima sessão.

A conta: as três regiões cabem quando `viewport ≥ 264 + 352 + 416 = 1032px` (sidebar + piso do painel + a reserva de 26rem da conversa). Com a sidebar recolhida, o mesmo cabe a partir de **812px**. Abaixo disso não há o que recolher — o painel já está no piso.

### DF3C.4 — O teto do painel passa a enxergar a sidebar recolhida

`100vw - var(--sidebar-width) - 26rem` passa a usar a largura **real** da sidebar naquele momento. Sem isso, a DF3C.3 libera 220px que o painel não pode usar.

Medido na janela padrão de 887px: hoje a conversa fica com **271px**; com as duas mudanças, **416px**.

### DF3C.5 — A alça é o _window splitter_ da WAI-ARIA, medido em pixels

`role="separator"`, `tabIndex=0`, `aria-orientation="vertical"`, `aria-controls` apontando o painel, `aria-valuemin`/`valuenow`/`valuemax`. Teclado: setas movem 16px, `Home`/`End` vão ao piso e ao teto, `Enter` fecha.

Duas escolhas contra a letra do padrão, ambas por honestidade: os valores vão em **pixels**, não na escala 0–100 sugerida (é o que o componente realmente controla, e o que o teste de nível 2 consegue assertar); e `Enter` **fecha sem restaurar**, porque com o painel fechado a alça não existe — quem restaura é o clipe ou `Ctrl+B`.

Do `react-resizable-panels`, dois detalhes: área de acerto de **10px** para mouse sobre a linha de 1px que já existe, e **duplo clique volta à largura padrão**.

### DF3C.6 — A largura mora no provider, e o arrasto não passa pelo React

Decisão do usuário: sobrevive à troca de anexo e ao modelo respondendo; morre no reinício. Trocar de conversa continua fechando o painel — o que reseta é a visibilidade, não o número.

Durante o arrasto, `pointermove` escreve `--artifact-width` direto no nó por `ref`; o estado do React só é tocado no `pointerup`. O `clamp` que já existe segue dono dos limites — o arrasto escreve o valor bruto, exatamente como o F-3-A preparou (DF3A.4).

Do `shadcn-resizable-sidebar` e da doc de _pointer events_: rastrear `pointerId`, `setPointerCapture` no `pointerdown`, tratar `pointercancel`, `touch-action: none` na alça, e **desligar a seleção de texto no `body` durante o arrasto** — sem isso, arrastar seleciona a conversa inteira. O retângulo de referência é medido **uma vez**, no `pointerdown`.

### DF3C.7 — Arrastar além do piso fecha o painel

Com folga de 40px depois do piso, para não fechar por tremor de mão. É o comportamento do rail do `shadcn-resizable-sidebar`, e é o desfazer natural de um arrasto que já foi longe demais.

⚠️ **É o item mais provável de cair na prova ao vivo.** Se fechar por acidente uma vez, sai — e o plano registra a queda em vez de defendê-lo.

---

## Passos

### 1. Transição de entrada e saída (DF3C.1)

`closing` no `ArtifactProvider`, `ArtifactPanel.module.css` com o fade, cancelamento do fechamento pendente. Nível 2: abre, fecha só depois do tempo, e um `toggle` durante o fechamento cancela em vez de reabrir.

### 2. A sidebar vira controlada (DF3C.2)

Refactor puro: `collapsed` sobe para o `App.tsx`, `Sidebar` ganha duas props. **Zero mudança de comportamento** — `Sidebar.test.tsx` é o contrato, e nenhuma asserção deve mudar. Se alguma mudar, a extração passou do ponto.

### 3. O painel pede espaço (DF3C.3, DF3C.4)

A regra de "cabe?" numa função pura ao lado do `AppShell`, com os três guardas; o teto do painel passa a usar a largura real. Nível 2: recolhe abaixo do limiar, não recolhe acima, não reexpande ao fechar, e se desliga depois do override manual.

### 4. A alça (DF3C.5, DF3C.6, DF3C.7)

Ponteiro, teclado, duplo clique, fechar além do piso. Nível 2 cobre teclado e `aria-value*` — jsdom não faz layout, então **o arrasto em si é nível 4**.

### 5. Prova ao vivo

`pnpm dev` e o e2e. O que só a tela responde: o fade não piscando ao trocar de anexo; a sidebar recolhendo sem solavanco junto do fade; a alça sendo _pegável_ de fato (10px é teoria até o dedo tentar); o arrasto sem selecionar texto; e a sonda que este plano herda — a thread continuar colada no fundo enquanto o modelo escreve **e** a largura muda.

---

## Verificação

- `pnpm check:fast` depois de cada passo.
- `e2e/dev/artifact-panel.spec.ts` ganha o arrasto e a janela estreita, com **invariantes** (a conversa cresce, o painel encolhe), nunca pixel — a asserção em pixel do F-3-A mediu escala de DPI e falhou.
- Provocação obrigatória, uma sabotagem por vez.

---

## Fora do escopo deste plano

| | Onde vai |
|---|---|
| Copiar imagem, canal `image:bytes` | `F-3-E` |
| Dataset no painel, e a paginação | `F-3-D` |
| Largura sobrevivendo ao reinício | não entra — decisão do usuário |
| Painel destacável em janela própria | fora do F-3 inteiro |

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 26/08/2026 | — | plano escrito, ainda não executado | Escrito depois de uma pesquisa ampla pedida pelo usuário (Context7 + web). Ela derrubou o risco do `useStickToBottom` por leitura do fonte, achou a armadilha do `@starting-style` na saída, deu nome ao padrão do arrasto (_window splitter_ da APG) e trouxe a contra-evidência do VS Code/Slack contra a DF3C.3 — que o usuário manteve depois de vê-la. O corte do F-3 passou a cinco planos com a saída do copiar imagem. |
