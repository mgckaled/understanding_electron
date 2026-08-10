---
name: design-system
description: Tokens de design do crivo — os dois níveis (primitivo/semântico) e a regra de nenhum componente tocar o primitivo direto, as duas densidades (chrome compacto vs superfície de leitura), tema pelo sistema operacional sem alternador manual, comportamento de desktop (seleção de texto, foco, movimento), os cinco primitivos (Button, Field, Panel, Toolbar, Dialog) em CSS Modules, ViewState/StateView e o registro central de mensagens de erro. Use ao criar um componente novo, escolher uma cor, medida ou tamanho de texto, abrir um modal, decidir onde um estado de UI mora, ou tratar um AppError na interface.
---

# Design tokens — crivo

> Escrito na fase [05](../../../docs/plan/implemented/05-design-tokens.md) do plano de fundação. Fonte completa, com o porquê de cada decisão: o documento linkado acima.

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

Componente escreve `var(--color-surface)`, nunca `var(--gray-N)`, nunca um `#hex` solto. **Regra sem exceção** (fora espessura de borda de 1–2px, hairline universal que nenhum design system tokeniza): `src/renderer/src/shared/ui/tokens.css` é a única fonte, e `grep` por `#` seguido de hex em `*.module.css` fora desse arquivo é o teste.

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

## Tema pelo sistema operacional, sem alternador

`prefers-color-scheme` decide, e mais nada. Um alternador manual exige persistir a escolha, sincronizar `nativeTheme` no main e propagar por IPC — trabalho real que nada no app pede hoje. Como a estrutura de tokens não muda quando ele chegar, adiar não cobra juros depois.

`--color-bg` é o único valor que precisa existir em dois lugares: o CSS e o `backgroundColor` do `BrowserWindow` em `src/main/index.ts` (fase 03) não compartilham fonte. Os dois arquivos têm comentário cruzado — ao mudar um, mude o outro.

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

Um campo de texto mantém o próprio rascunho (`useState(String(valor))`) — é a forma certa, e a fase 13 registrou por quê: clampar a cada tecla faz limpar o campo virar `1`, e quem digita "2" depois termina com `12`. A fase 14 encontrou o outro lado: quando esse valor passa a vir de I/O, o `useState` copia o **default** e o congela, porque o primeiro render acontece antes da resposta. Com `<dialog>` é pior — ele mantém os filhos montados fechado, então o primeiro render é o boot do aplicativo.

**Regra:** um hook que serve valor assíncrono expõe `loaded`, e o controle que copia só monta quando ele é verdadeiro (`{open && loaded && <Campo />}`). Quem apenas **lê** o valor pode ignorar `loaded`; quem o copia, não. Diagnóstico completo em [`docs/HISTORY.md`](../../../docs/HISTORY.md) § armadilhas.

## Erro é dado em inglês no contrato, texto em português na borda

`src/renderer/src/shared/ui/messages.ts` mapeia `AppError['kind']` para texto, via `Record<ErrorKind, string>` — o `pnpm typecheck` força toda entrada nova da união a ganhar mensagem aqui. O fallback genérico dentro de `errorMessage()` é a garantia gêmea em runtime: protege contra um `kind` que este build não conhece (main mais novo que o renderer), não contra esquecimento em desenvolvimento — isso o typecheck já pega.

## Os cinco primitivos: um diretório, um `.module.css`

`Button`, `Field`, `Panel`, `Toolbar` e `Dialog` em `src/renderer/src/shared/ui/<Nome>/`, cada um com seu módulo CSS ao lado.

`Dialog` (fase 13, D13.8) é o `<dialog>` nativo com `showModal()`, sem dependência: camada superior, foco preso, `Esc`, foco devolvido ao gatilho e `::backdrop` estilizável vêm da plataforma. `closedby="any"` fecha ao clicar fora sem handler próprio — confirmado no Chromium 148 que o Electron 42 embute, lendo o IDL, não uma tabela de compatibilidade. **Configuração é modal, não rota:** um destino de navegação desmonta o que estava na tela; o modal é irmão na árvore, então uma resposta em fluxo continua chegando atrás. Duas armadilhas registradas: `eslint-plugin-react` ainda não conhece `closedby` (liberado em `eslint.config.mjs`, não por linha) e **o jsdom não implementa `<dialog>` de forma alguma** — há um polyfill mínimo em `test/setup-renderer.ts` que só permite montar o componente; camada superior, foco preso e `Esc` só se verificam ao vivo. CSS Modules já funciona sem configuração no Vite (arquivo terminado em `.module.css`), com nomes de classe exportados exatamente como escritos — sem conversão automática para camelCase, então as classes já nascem em camelCase no `.module.css` para acesso direto via `styles.algumaCoisa`.

`Field` clona o `children` (`cloneElement`) para injetar `id`/`aria-describedby` no controle real, o que o deixa agnóstico ao tipo de input. `Button` esconde o rótulo com `visibility: hidden` durante `loading` (não `color: transparent`) para o spinner herdar `currentColor` — a cor certa do `variant`, sem precisar de uma cor extra por variante.

## Ref é prop comum desde o React 19

Não precisa `forwardRef` para um componente funcional aceitar `ref` — ele chega como qualquer outra prop tipada (`ComponentProps<'button'>` já inclui `ref`). Vale para qualquer primitivo novo que precise expor o elemento real (foco programático, medição de layout).
