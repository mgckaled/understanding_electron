---
name: design-system
description: Tokens de design do crivo — o design system como envelope (veste o que já existe; feature nova nasce vestida no próprio plano), os dois níveis de token (primitivo/semântico), Tailwind v4 sobre `tokens.css`, as duas densidades (chrome vs leitura), tema por `nativeTheme`, e os sete primitivos de `shared/ui/`. Use ao criar um componente, escolher cor/medida/texto, abrir modal/popover, decidir onde um estado de UI mora, ou tratar um `AppError` na interface.
---

# Design tokens — crivo

> Inventário de consulta rara — ausências registradas, convenções sem token, medidas one-off, o detalhe de `@theme inline` — mora em [`reference.md`](reference.md), nesta pasta. Aqui fica o que decide a primeira linha de um componente.

## O design system é um envelope, e essa é a ideia central

Ele **envelopa**: define a linguagem visual, e não constrói feature nenhuma. A consequência é a régua que resolve quase toda dúvida de escopo. Diante de um alvo visual, cada elemento cai num de dois lados:

| | Quem faz |
|---|---|
| **Já existe no app** | o design system. Ganha a linguagem |
| **Ainda não existe** | o plano da própria feature, depois — já vestido, porque o DS estará pronto |

**Um alvo visual não é lista de feature a construir.** Ele é o retrato do app *depois* que os planos seguintes rodarem sobre este DS — então mostra coisas que o DS nunca vai entregar, e isso não é lacuna. O alvo do crivo é [`docs/reference/handoff-ds-ago2026/`](../../../docs/reference/handoff-ds-ago2026/README.md), dono da tabela de distância e de quem faz cada item.

⚠️ **A leitura errada já custou duas vezes** — uma descartou cinco dos seis alvos por julgá-los como código; a outra transformou o alvo em checklist de features e produziu impasses inexistentes (*"onde vai o orçamento de contexto?"*). Ambos dissolvem pela régua. **Colocação de elemento que já existe é decisão de rotina, não pergunta.**

## App de desktop não é site

`src/renderer/src/assets/base.css` fixa isso uma vez: `user-select: none` na raiz (com `.selectable` para o que é dado copiável — caminho, célula, mensagem de erro), sem rolagem elástica, `:focus-visible` com anel só quando o teclado foi usado (`:focus` sozinho não mostra nada), `prefers-reduced-motion` zerando duração. Densidade, seleção, rolagem e duração descobertas tarde viram varredura por todo componente já escrito.

## Duas densidades, e é preciso saber de que lado se está (D13.6)

| | Densidade | Quem |
|---|---|---|
| **Chrome** | compacta — `--font-size-sm` é o corpo, 14px | sidebar, nav, rodapé, cabeçalho da conversa, controles do composer, toolbar, modal |
| **Leitura** | generosa — `--font-size-reading` (18px) | mensagem do usuário, resposta do assistente, artefatos, o texto que se digita no composer |

O critério não é "é importante?", é **quanto tempo o olho fica ali**: chrome se escaneia, resposta de modelo se lê por um minuto seguido, e 13px cansa nessa duração.

**Título de superfície de leitura é proporcional ao tamanho de leitura, não à escala de chrome.** Os títulos do markdown são `em` dentro de `.markdown` (`1.4em`/`1.2em`/`1.05em`), que resolvem contra `--font-size-reading` no pai — mude o tamanho de leitura e eles acompanham sozinhos. A escala em camiseta dimensiona chrome; são dois sistemas diferentes, e "aumentar a leitura do chat" precisa ser um número só, não uma varredura pelo CSS de feature afora.

## Dois níveis de token, componente só toca o segundo

```css
--gray-2: #16171a;                  /* primitivo — a cor existe */
--color-surface: var(--gray-3);     /* semântico — a cor significa algo */
```

Componente escreve `var(--color-surface)` (ou a utilidade Tailwind equivalente), nunca `var(--gray-N)`, nunca um `#hex` solto. **Regra sem exceção** — fora espessura de borda de 1–2px, hairline universal que nenhum design system tokeniza. `src/renderer/src/shared/ui/tokens.css` é a única fonte.

`guard.mjs` verifica os dois lados: cor literal e token desconhecido em `*.module.css`/`tailwind.css`, e — do lado Tailwind — valor arbitrário com cor (`bg-[#0d5bd9]`), primitivo alcançado por atalho v4 (`bg-(--gray-3)`) e cor literal em `style={{}}`/`className`, em todo `.tsx` de `src/renderer/`.

`--gray-1` a `--gray-13` é a escala fixa (não muda com tema; `--gray-13: #ffffff` é o topo que o tema claro usa para elevação). Tema claro (`@media (prefers-color-scheme: light)`) redefine **só a camada semântica** — e mapeia por **intenção**, escrita à mão, não por espelhamento mecânico da escala: ela é calibrada dark-first e não tem resolução na ponta clara, então no claro a elevação vai em direção ao branco (`--color-surface` e `--color-surface-raised` compartilham `--gray-13`, distinguidos por borda). D10.3.

## Cor de estado tem duas formas: sólido e texto são dois tokens (D10.1)

Um token de cor de estado serve a **duas** funções físicas opostas, e um único valor não serve às duas: um fundo sólido precisa ser **escuro** o bastante para carregar texto branco; uma cor de texto precisa ser **clara** o bastante para viver sobre superfície escura. `--accent-9: #4c8dff` era literalmente uma cor de texto sendo usada como fundo de botão — 2,96:1 com rótulo branco.

```css
--color-accent        /* sólido — preenche fundo (Button primário) */
--color-on-accent     /* rótulo sobre esse fundo sólido */
--color-accent-text   /* texto e foco sobre superfície (anel, borda, link) */
```

**Regra de primeira linha:** ao pintar `color:`, `border-color:` ou `outline:` com uma cor de estado, use a variante `-text`; o sólido (`--color-accent`, `--color-danger`) é só para `background`/`accent-color`. O rótulo sobre fundo sólido é o terceiro caso (`--color-on-accent`/`--color-on-danger`). Vale igual para `danger`, `warn`, `ok`. No primitivo a mesma separação aparece como sufixo: `--blue-11-dark`/`--blue-11-light`, e o par equivalente em `red`/`amber`/`green` (`blue` é a única escolha de gosto do conjunto; o resto segue convenção) — uma quinta cor de estado nasce com o par, não com um primitivo só.

⚠️ **O que garante isso não é o CSS — é `tokens.contrast.test.ts`**, que resolve cada `var()` até o `#hex` e mede WCAG AA nos dois temas, para uma lista de pares **escrita à mão** (`[primeiro-plano, fundo, razão-mínima]`). Esse registro é a fonte da **intenção**: a linha `['warn-text', 'surface', 4.5]` afirma que `--color-warn-text` existe para ser primeiro plano sobre superfície — nenhuma análise estática sabe disso. **Cor nova nasce com sua linha lá**, na hora em que um componente a usa; o registro nunca descobre um par novo sozinho.

**Os três níveis de texto separam por peso, não por legibilidade.** `--color-text`/`-text-muted`/`-text-faint` — os três precisam bater AA sobre `--color-surface`, e o teste mede os três. `--color-text-faint` carrega o rótulo de autoria do chat e a dica do `Field`: informação, não decoração — reduzir seu contraste "porque é o nível mais fraco" quebraria um caso de uso real.

## Hover e radius: as duas convenções que decidem uma classe

**Hover de superfície sobe um degrau na escada existente**, nunca tint: `bg-surface` → `hover:bg-surface-raised`, e o inverso onde o item já parte de `bg-surface-raised`. Seleção/estado ativo é composição de três coisas, não um fundo: borda esquerda de 2px na cor de acento (`border-l-2`, largura **sempre reservada**, mesmo inativa, para o texto não deslocar ao ativar) + o mesmo `bg-surface-raised` do hover + `font-semibold`.

**Radius** (`sm` 4px, `md` 6px, `lg` 10px, `full` circular) **não** segue "sm = controle, md = card". Medido: **`md` é o default** (botão, input, linha de lista, item de menu, contêiner sem escolha própria); **`lg` é o contêiner de superfície primário** (`Dialog`, `Popover`, os três cartões de anexo, `Composer`, bolha de mensagem); **`sm` tem um único consumidor** (`CapabilityChip`); `full` é circular/pílula.

## Tema: alternador manual sobre `nativeTheme`, `tokens.css` nunca muda (DS4.2)

Três estados em `AppSettings.theme` (`system`/`light`/`dark`, `shared/ipc.ts`), com alternador segmentado em Configurações. O mecanismo é só `nativeTheme.themeSource`: setá-lo no main **já propaga `prefers-color-scheme` para o renderer**, então `@media (prefers-color-scheme: light)` em `tokens.css` continua sendo o único lugar que decide cor por tema, **sem nenhuma linha alterada**. `register-all.ts` lê o `theme` salvo e seta `themeSource` antes de qualquer janela existir (sem flash); `settings:write` seta de novo quando o campo muda.

⚠️ **`--color-bg` é o único valor que precisa existir em dois lugares.** O CSS e o `backgroundColor` do `BrowserWindow` em `src/main/index.ts` não compartilham fonte — são **dois** valores possíveis do lado do main (`nativeTheme.shouldUseDarkColors` decide qual), lidos frescos a cada `createWindow()`. Os dois arquivos têm comentário cruzado: ao mudar um, mude o outro.

## `ViewState<T>` mora no renderer, não em `shared/`

```ts
type ViewState<T> =
  | { status: 'idle' }
  | { status: 'loading'; progress?: JobProgress }
  | { status: 'ready'; data: T }
  | { status: 'empty' }
  | { status: 'cancelled' }
  | { status: 'error'; error: AppError }
```

Vive em `src/renderer/src/shared/ui/state.ts`. `src/shared/` (raiz) é o que atravessa a fronteira de processo — o main precisa concordar com ele. `ViewState` é como o renderer decide desenhar; o main não tem opinião nenhuma sobre isso, e colocá-lo em `shared/` acoplaria o processo privilegiado a decisão de tela.

`<StateView state={...} render={(data) => ...} />` cobre os cinco estados que não são `ready` e delega `ready` ao `render`. `loading` mostra barra determinada quando `progress.total` não é nulo, indeterminada quando é.

> ⚠️ **Armadilha:** `src/renderer/src/shared/` e `src/shared/` compartilham o segmento `shared/` no caminho. Um glob mal ancorado (`'src/shared/**'` sem `/` inicial) captura os dois — foi o que aconteceu com `coverage.include` do Vitest. Ver skill [`testing`](../testing/SKILL.md) ao mexer em configuração que use glob sobre `src/`.

## Controle que COPIA um valor precisa saber se o valor já chegou

**Regra:** um hook que serve valor assíncrono expõe `loaded`, e o controle que copia o valor (`useState(String(valor))` — nunca quem apenas lê) só monta quando `loaded` é verdadeiro (`{open && loaded && <Campo />}`). Senão congela o default de antes de a resposta chegar, e `<dialog>` agrava porque mantém os filhos montados fechado. Diagnóstico: [`ARMADILHAS.md`](../../../docs/ARMADILHAS.md) § *Um controle que copia o valor no `mount`*.

## Erro é dado em inglês no contrato, texto em português na borda

`src/renderer/src/shared/ui/messages.ts` mapeia `AppError['kind']` para texto, via `Record<ErrorKind, string>` — o `pnpm typecheck` força toda entrada nova da união a ganhar mensagem aqui. O fallback genérico dentro de `errorMessage()` é a garantia gêmea em runtime: protege contra um `kind` que este build não conhece (main mais novo que o renderer), não contra esquecimento em desenvolvimento — isso o typecheck já pega.

## Tailwind v4 sobre `tokens.css` — CSS Modules só por limite físico

`src/renderer/src/assets/tailwind.css` declara `@theme inline` mapeando cada token semântico de `tokens.css` para uma variável Tailwind (`--color-*`), e `@utility` para o que a paleta padrão não cobre (`bg-accent`, `bg-danger`, `bg-warn`, `bg-ok`, mais as de animação). Componente escreve `className="bg-surface text-accent-text"`, nunca `var()` direto.

⚠️ **`tokens.css` nunca entra num `@layer`** (DS1.5). Violá-lo some com toda a cor do app, e é o único aviso que sobrevive como linha solta no fonte — o resto da narrativa de `base.css`/`tailwind.css` está em [`reference.md`](reference.md).

**Quatro componentes ficam em CSS Modules, por limite físico real, não por não terem sido migrados:** `Dialog`, `Popover`, `MarkdownMessage` e `ArtifactPanel`. Os dois primeiros porque a plataforma (`<dialog>`, `popover="auto"`) exige seletor que o Tailwind não alcança (`::backdrop`, `[popover]:not(:popover-open)`); o terceiro porque o conteúdo é HTML gerado pelo `react-markdown`, sem className previsível; o quarto — o único que não é primitivo — porque `@starting-style` precisa de **regra**, não de classe (DF3C.1). `Button`, `Field`, `Switch` e `Slider` são 100% utilitários.

## Os sete primitivos: um diretório por componente

`Button`, `Field`, `Dialog`, `Popover`, `MarkdownMessage`, `Switch` e `Slider` em `src/renderer/src/shared/ui/<Nome>/`.

⚠️ **O que decide se um oitavo nasce não é a contagem, é ter mais de um chamador.** `Panel` e `Toolbar` existiram e foram apagados no DS-8 por ficarem sem nenhum — sobreviveram duas migrações inteiras sem que ninguém remedisse. Se um layout de ações ou uma superfície com borda precisar existir de novo, nasce quando o **segundo** chamador aparecer, não antes.

`Dialog` (D13.8) é o `<dialog>` nativo com `showModal()`, sem dependência: camada superior, foco preso, `Esc`, foco devolvido ao gatilho e `::backdrop` estilizável vêm da plataforma. `closedby="any"` fecha ao clicar fora sem handler próprio — confirmado no Chromium 148 que o Electron 42 embute, lendo o IDL, não uma tabela de compatibilidade. **Configuração é modal, não rota:** um destino de navegação desmonta o que estava na tela; o modal é irmão na árvore, então uma resposta em fluxo continua chegando atrás.

`Popover` (DS-4) é o atributo nativo `popover="auto"` + CSS anchor positioning — mesmo raciocínio, plataforma em vez de biblioteca. Controle 100% imperativo (`open` prop → `useEffect` → `showPopover()`/`hidePopover()`), nunca `popovertarget` declarativo; um listener de `toggle` sincroniza o fechamento nativo (clique fora, `Esc`) de volta ao `onClose`.

⚠️ **jsdom não implementa nem `<dialog>` nem a Popover API** — há shim mínimo em `test/setup-renderer.ts` que só permite montar. Camada superior, foco preso e `Esc` só se verificam ao vivo. E o `Popover` tem uma armadilha além da ausência: a folha default do próprio jsdom já traz `[popover]:not(:popover-open) { display:none }`, que o shim não alcança, então **todo** conteúdo de `Popover` computa `display:none` sob jsdom — consultas de nível 2 com `getByRole` precisam de `{ hidden: true }`. Também: `eslint-plugin-react` ainda não conhece `closedby` (liberado em `eslint.config.mjs`).

`Field` clona o `children` (`cloneElement`) para injetar `id`/`aria-describedby` no controle real, o que o deixa agnóstico ao tipo de input. `Button` esconde o rótulo com `visibility: hidden` durante `loading` (não `color: transparent`) para o spinner herdar `currentColor` — a cor certa do `variant`, sem cor extra por variante.
