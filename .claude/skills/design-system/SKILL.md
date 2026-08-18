---
name: design-system
description: Tokens de design do crivo — o design system como envelope (define a linguagem visual, não constrói feature; o que já existe ganha a linguagem, o que ainda não existe nasce depois já vestido), os dois níveis (primitivo/semântico) e a regra de nenhum componente tocar o primitivo direto, Tailwind v4 sobre `tokens.css` com CSS Modules só onde há limite físico (Dialog, Popover, MarkdownMessage), as duas densidades (chrome compacto vs superfície de leitura), tema por `nativeTheme` com alternador manual (Sistema/Claro/Escuro), comportamento de desktop (seleção de texto, foco, movimento), nove primitivos (Button, Field, Panel, Toolbar, Dialog, Popover, MarkdownMessage, Switch, Slider), ViewState/StateView e o registro central de mensagens de erro. Use ao criar um componente novo, escolher uma cor, medida ou tamanho de texto, abrir um modal ou popover, decidir onde um estado de UI mora, ou tratar um AppError na interface.
---

# Design tokens — crivo

> Escrito na fase [05](../../../docs/plan/implemented/05-design-tokens.md) do plano de fundação; a camada de estilo dos componentes foi reconstruída sobre Tailwind v4 na trilha DS (DS-1 a DS-5, ago/2026) — ver [`HISTORY-archive.md`](../../../docs/HISTORY-archive.md). Os tokens em si (`tokens.css`, os dois níveis, a régua de contraste) não mudaram; o que mudou é como o componente os consome.

## O design system é um envelope, e essa é a ideia central

Ele **envelopa**: define a linguagem visual, e não constrói feature nenhuma. É como funciona na prática na maioria dos projetos, e a consequência é toda a razão de a trilha DS rodar **antes** do arco de features — quando o anexo, o cartão de dados e a proposta de passos chegarem, a pergunta *"como isto fica?"* já está respondida, e cada um nasce vestido.

Daí a régua que resolve quase toda dúvida de escopo. Diante de um alvo visual, cada elemento cai num de dois lados:

| | Quem faz |
|---|---|
| **Já existe no app** | o design system. Ganha a linguagem |
| **Ainda não existe** | o plano da própria feature, depois — já vestido, porque o DS estará pronto |

**Um alvo visual não é lista de feature a construir.** Ele é o retrato do app *depois* que os planos seguintes rodarem sobre este DS — então mostra coisas que o DS nunca vai entregar, e isso não é lacuna. O alvo do crivo é [`docs/reference/handoff-ds-ago2026/`](../../../docs/reference/handoff-ds-ago2026/README.md), que é o dono da tabela de distância e de quem faz cada item.

⚠️ **A leitura errada já custou duas vezes em ago/2026** — uma delas descartou cinco dos seis alvos por julgá-los como código; a outra transformou o alvo em checklist de features e produziu impasses inexistentes (*"onde vai o orçamento de contexto?"*, *"remover o painel de abrir arquivo bloqueia o plano 16?"*). Ambos dissolvem pela régua: o que existe ganha o envelope, e quem substitui um elemento é o plano que traz o substituto. **Colocação de elemento que já existe é decisão de rotina dentro da trilha, não pergunta.**

## App de desktop não é site

Densidade, seleção de texto, rolagem, duração de animação — cada diferença descoberta tarde é uma varredura por todo componente já escrito. `src/renderer/src/assets/base.css` fixa isso uma vez: `user-select: none` na raiz (com `.selectable` para o que é dado copiável — caminho, célula, mensagem de erro), sem rolagem elástica, `:focus-visible` com anel só quando o teclado foi usado (`:focus` sozinho não mostra nada), `prefers-reduced-motion` zerando duração.

## O aplicativo tem duas densidades, e é preciso saber de que lado se está (D13.6)

A superfície de leitura chegou com o chat e tomou, em silêncio, uma decisão de design system que ninguém tinha escrito. Está escrita agora, porque sem ela o próximo componente não sabe qual escala usar:

| | Densidade | Quem |
|---|---|---|
| **Chrome** | compacta — a escala de desktop da fase 05 (`--font-size-sm` é o corpo, 13px) | sidebar, nav, rodapé, cabeçalho da conversa, controles do composer, toolbar, modal |
| **Leitura** | generosa — `--font-size-reading` (18px) | mensagem do usuário, resposta do assistente, artefatos, o texto que se digita no composer |

O critério não é "é importante?", é **quanto tempo o olho fica ali**: chrome se escaneia, resposta de modelo se lê por um minuto seguido, e 13px cansa nessa duração.

**Título de superfície de leitura é proporcional ao tamanho de leitura, não à escala de chrome.** Os títulos do markdown são `em` dentro de `.markdown` (`1.4em`/`1.2em`/`1.05em`), que resolvem contra `--font-size-reading` no pai — mude o tamanho de leitura e eles acompanham sozinhos. Acrescentar um degrau de 18 à escala em camiseta renomearia todo degrau acima dele por causa de **um** consumidor; a escala dimensiona chrome, e são dois sistemas diferentes.

## Dois níveis de token, componente só toca o segundo

```css
--gray-2: #16171a;                  /* primitivo — a cor existe */
--color-surface: var(--gray-3);     /* semântico — a cor significa algo */
```

Componente escreve `var(--color-surface)`, nunca `var(--gray-N)`, nunca um `#hex` solto. **Regra sem exceção** (fora espessura de borda de 1–2px, hairline universal que nenhum design system tokeniza): `src/renderer/src/shared/ui/tokens.css` é a única fonte. `guard.mjs` verifica os dois lados: cor literal e token desconhecido em `*.module.css`/`tailwind.css`, e — do lado Tailwind — valor arbitrário com cor (`bg-[#0d5bd9]`), primitivo alcançado por atalho v4 (`bg-(--gray-3)`) e cor literal em `style={{}}`/`className`, em todo `.tsx` de `src/renderer/`.

`--gray-1` a `--gray-13` é a escala fixa (não muda com tema; `--gray-13: #ffffff` é o topo que o tema claro usa para elevação). Tema claro (`@media (prefers-color-scheme: light)`) redefine **só a camada semântica** — mas mapeia por **intenção**, escrita à mão, e **não** por espelhamento mecânico da escala. A escala é calibrada dark-first e não tem resolução na ponta clara, então no claro a elevação vai em direção ao branco (`--color-surface` e `--color-surface-raised` compartilham `--gray-13`, distinguidos por borda). Os primitivos permanecem os mesmos números em ambos os temas. Ver [fase 10](../../../docs/plan/implemented/10-cor-contraste-e-tema-claro.md) (D10.3).

## Cor de estado tem duas formas: sólido e texto são dois tokens (D10.1)

Um token de cor de estado serve a **duas** funções físicas opostas, e um único valor não serve às duas: um fundo sólido precisa ser **escuro** o bastante para carregar texto branco; uma cor de texto precisa ser **clara** o bastante para viver sobre superfície escura. `--accent-9: #4c8dff` era literalmente uma cor de texto sendo usada como fundo de botão — 2,96:1 com rótulo branco. A separação virou estrutura de nome:

```css
--color-accent        /* sólido — preenche fundo (Button primário) */
--color-on-accent     /* rótulo sobre esse fundo sólido */
--color-accent-text   /* texto e foco sobre superfície (anel, borda, link) */
```

E o mesmo para `danger`, `warn`, `ok`. **Regra de primeira linha:** ao pintar `color:`, `border-color:` ou `outline:` com uma cor de estado, use a variante `-text`; o sólido (`--color-accent`, `--color-danger`) é só para `background`/`accent-color`. O rótulo sobre um fundo sólido é o terceiro caso: `--color-on-accent`/`--color-on-danger`.

O que garante isso não é o CSS — é o teste `tokens.contrast.test.ts`, que resolve cada `var()` até o `#hex` e mede WCAG AA nos dois temas, para uma lista de pares **escrita à mão** (`[primeiro-plano, fundo, razão-mínima]`). Esse registro é a fonte da **intenção** de cada token: a linha `['warn-text', 'surface', 4.5]` afirma que `--color-warn-text` existe para ser primeiro plano sobre superfície — nenhuma análise estática de `tokens.css` sabe disso, porque o uso vive no CSS do componente. Cor nova (inclusive `--syntax-*` quando chegar) nasce com sua linha lá.

## Tema: alternador manual sobre `nativeTheme`, `tokens.css` nunca muda (DS4.2)

Decisão revertida em ago/2026, a pedido explícito do usuário — a versão anterior desta seção dizia "sem alternador". Três estados em `AppSettings.theme` (`system`/`light`/`dark`, `shared/ipc.ts`), com um alternador segmentado em Configurações. O mecanismo é só `nativeTheme.themeSource`: setá-lo no main **já propaga `prefers-color-scheme` para o renderer** (documentado no próprio Electron — `nativeTheme.on('updated')`/a query CSS casam com o valor setado), então `@media (prefers-color-scheme: light)` em `tokens.css` continua sendo o único lugar que decide cor por tema, **sem nenhuma linha alterada**. `register-all.ts` lê o `theme` salvo e seta `themeSource` antes de qualquer janela existir (sem flash); `settings:write` seta de novo quando o campo muda. Confirmado ao vivo: trocar de tema muda `--color-bg` na hora, e reabrir o app já bota no tema salvo.

`--color-bg` é o único valor que precisa existir em dois lugares: o CSS e o `backgroundColor` do `BrowserWindow` em `src/main/index.ts` não compartilham fonte — agora **dois** valores possíveis do lado do main (`nativeTheme.shouldUseDarkColors` decide qual), lidos frescos a cada `createWindow()` para cobrir tanto o boot quanto a recriação de janela no macOS. Os dois arquivos têm comentário cruzado — ao mudar um, mude o outro.

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

> ⚠️ **Armadilha:** `src/renderer/src/shared/` e `src/shared/` compartilham o segmento `shared/` no caminho. Um glob mal ancorado (`'src/shared/**'` sem `/` inicial) pode capturar os dois — foi o que aconteceu com `coverage.include` do Vitest, corrigido com `coverage.exclude: ['src/renderer/**']`. Ver skill `testing` e [`docs/HISTORY.md`](../../../docs/HISTORY.md) se mexer em configuração que usa glob sobre `src/`.

`<StateView state={...} render={(data) => ...} />` cobre os cinco estados que não são `ready` e delega `ready` ao `render`. `loading` mostra barra determinada quando `progress.total` não é nulo, indeterminada quando é — o próprio contrato ([`shared/ipc.ts`](../../../src/shared/ipc.ts)) admite total desconhecido.

## Controle que COPIA um valor precisa saber se o valor já chegou

**Regra:** um hook que serve valor assíncrono expõe `loaded`, e o controle que copia o valor (`useState(String(valor))`, nunca só quem apenas lê) só monta quando `loaded` é verdadeiro (`{open && loaded && <Campo />}`) — senão congela o default de antes da resposta chegar, e `<dialog>` agrava porque mantém os filhos montados fechado. Diagnóstico completo: [`docs/HISTORY.md`](../../../docs/HISTORY.md) § *Um controle que copia o valor no `mount`*.

## Erro é dado em inglês no contrato, texto em português na borda

`src/renderer/src/shared/ui/messages.ts` mapeia `AppError['kind']` para texto, via `Record<ErrorKind, string>` — o `pnpm typecheck` força toda entrada nova da união a ganhar mensagem aqui. O fallback genérico dentro de `errorMessage()` é a garantia gêmea em runtime: protege contra um `kind` que este build não conhece (main mais novo que o renderer), não contra esquecimento em desenvolvimento — isso o typecheck já pega.

## Tailwind v4 sobre `tokens.css` — CSS Modules só por limite físico

A trilha DS (DS-1 a DS-5, ago/2026) reconstruiu a camada de estilo dos componentes sobre Tailwind v4. `src/renderer/src/assets/tailwind.css` declara `@theme inline` mapeando cada token semântico de `tokens.css` para uma variável Tailwind (`--color-*`), e `@utility` para as classes que a paleta padrão não cobre (`bg-accent`, `bg-danger`, `bg-warn`, `bg-ok`, mais as `@utility` de animação). Componente escreve `className="bg-surface text-accent-text"`, nunca `var()` direto — `guard.mjs` cobre o lado JSX (seção acima).

**Três componentes ficam em CSS Modules, por limite físico real, não por não terem sido migrados:** `Dialog`, `Popover` e `MarkdownMessage`. Os dois primeiros porque a plataforma (`<dialog>`, `popover="auto"`) exige seletor que o Tailwind não alcança (`::backdrop`, `[popover]:not(:popover-open)`); o terceiro porque o conteúdo é HTML gerado dinamicamente pelo `react-markdown`, sem className previsível para aplicar utilitário. `Button`, `Field`, `Panel`, `Toolbar`, `Switch` e `Slider` são 100% classes utilitárias.

## Os nove primitivos: um diretório por componente

`Button`, `Field`, `Panel`, `Toolbar`, `Dialog`, `Popover`, `MarkdownMessage`, `Switch` e `Slider` em `src/renderer/src/shared/ui/<Nome>/`. Os dois últimos entraram no plano F-2 (ago/2026, `docs/plan/implemented/F-2-composer-modelo-sidebar.md`) — nenhum limite físico neles, então nenhum ganhou CSS Module.

`Dialog` (fase 13, D13.8) é o `<dialog>` nativo com `showModal()`, sem dependência: camada superior, foco preso, `Esc`, foco devolvido ao gatilho e `::backdrop` estilizável vêm da plataforma. `closedby="any"` fecha ao clicar fora sem handler próprio — confirmado no Chromium 148 que o Electron 42 embute, lendo o IDL, não uma tabela de compatibilidade. **Configuração é modal, não rota:** um destino de navegação desmonta o que estava na tela; o modal é irmão na árvore, então uma resposta em fluxo continua chegando atrás. Duas armadilhas registradas: `eslint-plugin-react` ainda não conhece `closedby` (liberado em `eslint.config.mjs`, não por linha) e **o jsdom não implementa `<dialog>` de forma alguma** — há um polyfill mínimo em `test/setup-renderer.ts` que só permite montar o componente; camada superior, foco preso e `Esc` só se verificam ao vivo. CSS Modules já funciona sem configuração no Vite (arquivo terminado em `.module.css`), com nomes de classe exportados exatamente como escritos — sem conversão automática para camelCase, então as classes já nascem em camelCase no `.module.css` para acesso direto via `styles.algumaCoisa`.

`Popover` (DS-4, passo 3) é o atributo nativo `popover="auto"` + CSS anchor positioning — mesmo raciocínio do `Dialog`, plataforma em vez de biblioteca. Controle 100% imperativo (`open` prop → `useEffect` → `showPopover()`/`hidePopover()`), nunca `popovertarget` declarativo; um listener de `toggle` sincroniza o fechamento nativo (clique fora, `Esc`) de volta ao `onClose`. **jsdom também não implementa a Popover API** — mesma família de shim do `Dialog` em `test/setup-renderer.ts` — e tem uma armadilha própria além da ausência: a folha de estilo default do próprio jsdom já tem `[popover]:not(:popover-open) { display:none }`, que o shim não alcança, então **todo** conteúdo de `Popover` computa `display:none` sob jsdom independente do estado real — consultas de nível 2 com `getByRole` precisam de `{ hidden: true }` (`docs/HISTORY.md` § jsdom esconde popover).

`Field` clona o `children` (`cloneElement`) para injetar `id`/`aria-describedby` no controle real, o que o deixa agnóstico ao tipo de input. `Button` esconde o rótulo com `visibility: hidden` durante `loading` (não `color: transparent`) para o spinner herdar `currentColor` — a cor certa do `variant`, sem precisar de uma cor extra por variante.
