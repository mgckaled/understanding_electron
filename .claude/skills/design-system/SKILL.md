---
name: design-system
description: Tokens de design do crivo — o design system como envelope (veste o que já existe; feature nova nasce vestida no próprio plano), os dois níveis de token (primitivo/semântico), Tailwind v4 sobre `tokens.css`, as duas densidades (chrome vs leitura), tema por `nativeTheme`, e os nove primitivos de `shared/ui/`. Use ao criar um componente, escolher cor/medida/texto, abrir modal/popover, decidir onde um estado de UI mora, ou tratar um `AppError` na interface.
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
| **Chrome** | compacta — a escala de desktop, recalibrada na DS5 (`--font-size-sm` é o corpo, 14px) | sidebar, nav, rodapé, cabeçalho da conversa, controles do composer, toolbar, modal |
| **Leitura** | generosa — `--font-size-reading` (18px) | mensagem do usuário, resposta do assistente, artefatos, o texto que se digita no composer |

O critério não é "é importante?", é **quanto tempo o olho fica ali**: chrome se escaneia, resposta de modelo se lê por um minuto seguido, e 13px cansa nessa duração.

**A recalibração da DS5:** os quatro degraus de baixo (`2xs`/`xs`/`sm`/`md`) subiram 1px cada, `lg` para cima nunca mexeu, depois de uma auditoria ao vivo constatar chrome lendo pequeno perto da superfície de leitura a 18px. Verificado contra o mapa `SIZE` do `Button` antes de commitar: `sm` (controle de 24px, texto agora 13px) e `md` (controle de 28px, texto agora 15px) mantêm folga de vários px, `line-height: normal` considerado — `--control-height-*` não mudou.

**Título de superfície de leitura é proporcional ao tamanho de leitura, não à escala de chrome.** Os títulos do markdown são `em` dentro de `.markdown` (`1.4em`/`1.2em`/`1.05em`), que resolvem contra `--font-size-reading` no pai — mude o tamanho de leitura e eles acompanham sozinhos. Acrescentar um degrau de 18 à escala em camiseta renomearia todo degrau acima dele por causa de **um** consumidor; a escala dimensiona chrome, e são dois sistemas diferentes. Ter o próprio token também significa que "aumentar a leitura do chat" fica sendo um número só, não uma varredura pelo CSS de feature afora.

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

Um degrau abaixo, no primitivo, a mesma separação aparece como sufixo: `--blue-11-dark`/`--blue-11-light` (e o par equivalente em `red`/`amber`/`green`) são a forma texto, legível sobre a superfície escura ou sobre branco — `blue` é a única escolha de gosto do conjunto, o resto segue convenção. Uma quinta cor de estado nasce com o mesmo par de sufixos, não com um primitivo só.

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

## Fundação de desktop: `base.css` e `tailwind.css` (DS-6)

Toda a narrativa de decisão que antes vivia espalhada em comentário dentro de `base.css`/`tailwind.css` mora aqui — os dois arquivos citam esta seção como referência única, no topo do arquivo. Só um aviso sobrevive como linha solta no fonte: violá-lo é catastrófico (some toda cor do app) e não é algo que quem lê só o arquivo adivinharia — `tokens.css` nunca entra num `@layer` (DS1.5).

### O que já existia, migrado para cá

**`@layer base`** (DS-1 passo 2): o arquivo inteiro cai na mesma camada do preflight do Tailwind, perdendo de qualquer utilitário sem disputa de especificidade — `@layer utilities` vem depois, em `main.tsx`.

**Duas correções ao preflight do Tailwind**, medidas na DS-1 passo 1, não adivinhadas: `* { margin: 0 }` leva o `dialog { margin: auto }` do navegador junto, e o modal cai em `0,0` em vez de centrado; `font: inherit` em controles troca `line-height: normal` por `1.5`, movendo cada rótulo 1px. `option`/`meter`/`::placeholder` revertem ao chrome nativo pelo mesmo motivo — padding do popup do dropdown, o `<meter>` que o orçamento de contexto desenha, cor de placeholder — adotar qualquer um deles é decisão da DS-3, não efeito colateral do reset.

**`:focus-visible` só reage ao teclado**: desktop pesa mais nisso que a web — o anel nunca aparece em clique de mouse, só quando o teclado foi usado.

**`tailwind.css` é arquivo próprio, nunca fundido em `tokens.css`** (DS1.1): `tokens.css` precisa continuar byte-idêntico para `tokens.contrast.test.ts` provar contraste contra ele, e as declarações `@theme inline` abaixo são ciclos que se referenciam pelo próprio nome (`--color-bg: var(--color-bg)`) — ciclo que só funciona porque uma declaração fora de `@layer` vence uma declaração dentro dele. Juntar os dois arquivos injetaria esses ciclos dentro do arquivo que o teste de contraste lê, quebrando a leitura.

**`@theme inline`** carrega `inline` porque todo valor é um `var()` para dentro de `tokens.css`: a utilidade precisa carregar a própria referência, senão o `@media` do tema claro (que redefine a camada semântica, nunca o tema em si) não alcançaria o valor novo. **`--color-*`/`--spacing-*`/`--text-*`/`--radius-*`/`--font-*: initial`** desligam o default do Tailwind de propósito — um `bg-slate-800` ou um `p-4` de 4px sobrevivendo seria um segundo lugar decidindo cor e densidade, a meia-migração que a trilha DS existe para evitar. **Medido, porque o palpite vai na direção contrária:** `--font-*: initial` **não** leva `--font-weight-*` junto — `font-bold` sobrevive; ele mata `font-sans`/`font-serif`, que competiriam com `--font-ui`.

**As solid fills (`bg-accent`, `bg-accent-hover`, `bg-danger`, `bg-warn`, `bg-ok`)** existem porque o namespace `--color-*` é tudo-ou-nada: declarar `--color-accent` em `@theme inline` também cunharia `text-accent`, o mesmo bug de 2,96:1 que a fase 10 mediu e matou (D10.1). Como `@utility`, só o fill existe — o errado não é escrevível. Variantes funcionam nelas, então o hover do `Button` é `hover:bg-accent-hover`.

**`animate-spinner`** tem nome próprio em vez do `animate-spin` do Tailwind porque aquele é travado em 1s e o deste projeto é `--duration-slow` (320ms) — `duration-*` seta `transition-duration`, nunca `animation-duration`. As `@keyframes` ficam fora do `@utility` porque ele não pode conter at-rule.

**`thinking-dot`/`dotThinking`/`animate-thinking-dot`** são os 14 pontos do `ThinkingMark` (F-1): um keyframe único, parametrizado por custom properties que `ThinkingMark.tsx` seta inline por ponto — o padrão que a própria doc do Tailwind mostra para valor por instância sobre uma utilidade compartilhada. Adicionado e removido ponto a ponto, na fronteira de `animationiteration` daquele ponto — nunca os 14 de uma vez, porque `--thinking-dot-delay` escalona quando cada um volta ao repouso de fato. **`0%`/`100%` do `dotThinking` precisam bater exatamente com a posição de repouso de `thinking-dot`**: `prefers-reduced-motion` (`base.css`) força uma única iteração de `0.01ms`, que pousa onde quer que `0%`/`100%` apontem — divergir congela a marca fora de forma para quem usa movimento reduzido.

### Alta — comportamento de desktop que faltava (DS-6)

- **`color-scheme` por tema.** Sem ele, o Chromium renderiza controle nativo (`<meter>`, `<option>`, scrollbar de sistema) no esquema padrão — visível de imediato, porque são exatamente os três seletores que a seção acima já devolve ao chrome nativo. Casa com a mesma `@media (prefers-color-scheme)` que `tokens.css` já usa, então segue `nativeTheme.themeSource` sem tocar componente nenhum. Verificado ao vivo nos dois temas.
- **`forced-colors: active`.** O Windows High Contrast Mode substitui cor de autor por cor de sistema (`ButtonText`/`Highlight` — cores de sistema CSS, não tokens do projeto); sem tratamento, controle interativo pode perder contorno visível. Verificado ao vivo com um tema de contraste do Windows ligado (Configurações → Acessibilidade → Temas de contraste).
- **`overflow-wrap: break-word` no `body`.** Caminho de arquivo do Windows, hash, id de modelo: string longa sem espaço quebra em vez de estourar o container. Quem precisa de outro comportamento (bloco de código) já define o próprio `white-space` (`MarkdownMessage`). **Não alcança célula de tabela de dado** (`DatasetPreview`/`DatasetQueryPanel`, `whitespace-nowrap`) — medido ao vivo: `white-space: nowrap` vence, a célula não quebra, permanece uma linha rolando horizontal dentro do `overflow-auto` do container, exatamente como antes.
- **Autofill do Chromium neutralizado.** O `box-shadow` inset usa `--color-surface-sunken` — "interior de campo", o mesmo token que `ConversationList` e `CloudSecrets` já usam em `bg-surface-sunken` nos inputs reais (não `--color-surface`, que é a superfície ao redor, não o campo). `transition: background-color 9999s` é o truque consolidado para impedir a animação de fundo do autofill sem recorrer a `!important`.
- **`caret-color: var(--color-accent-text)`.** Mesmo token do anel de foco e do link — o cursor de inserção herda a mesma intenção de destaque.
- **`-webkit-user-drag: none` em `img`/`svg`/`video`.** Evita o drag fantasma do SO ao clicar-e-arrastar uma imagem sem querer. Sem `user-select: none` junto — já herda de `html`, no topo do arquivo.
- **`img { display: block; max-width: 100% }`.** Imagem é `inline` por padrão, o que cria um espaço de baseline abaixo dela (o "gap fantasma"); `max-width` contém uma imagem maior que o container. O único consumidor real hoje é `ImageCard` (preview de anexo) — **medido ao vivo**, não só assumido: numa imagem de tamanho real (180×140), a diferença de altura entre `inline` e `block` é **zero** (o gap só aparece quando a imagem é menor que a linha de texto ao redor, o que não acontece aqui, sozinha dentro de um `<div>`). `MarkdownMessage` não conta como segundo consumidor: `urlTransform` zera todo `src` de imagem markdown sob o CSP `img-src 'self' data:` (D11.2) — nenhum `<img>` chega a renderizar ali hoje.

### Média — robustez e consistência (DS-6)

- **`::selection`** usa `color-mix(in oklab, var(--color-accent-text) 30%, transparent)` — cor da paleta em vez do default do SO, opção deliberada para consistência visual; funciona nos dois temas porque `--color-accent-text` já é redefinido no tema claro. Sem token novo. **Verificado ao vivo o contraste do texto selecionado nos dois temas** — `tokens.contrast.test.ts` só resolve pares de token escritos à mão, e a saída de um `color-mix()` não está nessa lista.
- **Números tabulares (`tabular-nums`) são convenção, não regra global.** Superfície de dados (pré-visualização de dataset, resultado de consulta, qualquer coluna numérica) deveria usar a utilidade `tabular-nums` do próprio Tailwind (`font-variant-numeric: tabular-nums` — confirmado via Context7 contra a doc oficial: é uma declaração estática, sem `var()`, então não interage com nenhum dos resets `--font-*`/`--text-*: initial` acima). Não é regra do `body` porque número tabular em prosa corrida fica menos legível — a aplicação é por componente de dado, quando esse componente existir.
- **Tokens fora de `@theme inline` — por que, e quais.** `--duration-*`, `--control-height-*`, `--table-row-height`, `--sidebar-width*` e o canal `--thinking-*` são consumidos por referência direta a `var()` (`duration-(--duration-fast)`, `h-(--control-height-sm)`), não por nome mapeado — eles não têm consumidor no formato nomeado (`bg-surface`, `rounded-md`) que justificaria a entrada em `@theme inline`. Fora deles, dois tokens semânticos ficam de fora por ter um único consumidor fora do Tailwind: `--color-backdrop` (só `Dialog.module.css`, CSS Module) e `--syntax-*` (paleta importada como conjunto, D12.4). Nenhum dos dois precisa de exposição — confirmado nesta sessão comparando `tokens.css` inteiro contra `@theme inline`.
- **`:disabled` é decisão por componente, não regra global.** Cada componente trata o próprio estado desabilitado (`disabled:opacity-50`, `disabled:cursor-not-allowed` no `Button`) porque a intensidade do esmaecimento depende da superfície do controle. Não ganha `[disabled]` global em `base.css` sem decisão própria de design system — hoje são poucos consumidores para justificar utilidade compartilhada.

### Leve — estado atual, documentado por escrito (DS-6)

Decisões que já existiam no código, sem registro escrito até agora.

- **Sem media query de largura.** O app é layout fixo de desktop — zoom muda o viewport efetivo em px CSS, mas não deveria disparar breakpoint. Uma media query de largura, se um dia for necessária, é decisão de design a tomar então, não ausência a corrigir.
- **`text-rendering: optimizeLegibility` + `-webkit-font-smoothing: antialiased`** no `body` são escolha deliberada de desktop, não default de navegador copiado sem pensar.
- **O reset global de `ul`** (`list-style: none; padding: 0`) tira marcador de toda lista por padrão; `MarkdownMessage.module.css` restaura `list-style`/`padding-left` para markdown renderizado. Qualquer outra superfície que precisar de lista opta de volta por conta própria.
- **A scrollbar usa `--color-border-strong`**, sem token dedicado — um único consumidor. Extrair `--color-scrollbar` só se um segundo consumidor aparecer ou a cor precisar divergir.
- **`::backdrop` é por componente**, hoje só `Dialog.module.css`. Sem regra global de backdrop em `base.css`; se um segundo componente precisar, decide-se então se extrai algo compartilhado.
- **Fills sólidos disponíveis:** `bg-accent`, `bg-accent-hover`, `bg-danger`, `bg-warn`, `bg-ok`. Não existe hover para `danger`/`warn`/`ok` porque `tokens.css` não declara `--color-danger-hover`/`--color-warn-hover`/`--color-ok-hover` — se um dia precisar, o token nasce primeiro, a utilidade depois.
- **`ease-initial` é palavra-chave do Tailwind (`ease`), não token.** `tokens.css` não declara nenhum `--ease-*` hoje; `Button`, `Switch` e `Sidebar` usam a palavra-chave embutida do Tailwind diretamente. Se um dia entrar token de curva de easing, mapeia-se aqui.

## Tokens — convenções e registros de ausência (DS-7)

Origem: relatório externo (`notes/reports/r_tokens-css.md`), 21 itens avaliados contra o repositório real, `advisor` (Opus) como filtro de chanceler. Só duas correções sobreviveram como fato — nenhum item virou token novo: DS-7 não adiciona nada a `tokens.css`/`tailwind.css`, é consolidação de narrativa (que vivia em comentário em `tokens.css`, migrada para cá no mesmo espírito do DS-6) e correção de duas contagens que tinham envelhecido. Entrada em [`HISTORY.md`](../../../docs/HISTORY.md).

### Hover e seleção já têm convenção — nenhum token de tint é necessário

Hover de superfície **sobe um degrau na escada existente**, nunca tint: `bg-surface` → `hover:bg-surface-raised` (`ConversationList`, `AttachButton`), e o inverso onde o item já parte de `bg-surface-raised` (itens de popover sobre painel elevado). Seleção/estado ativo (`ConversationList`, a barra de acento da DS-3) é a composição de três coisas, não um fundo: borda esquerda de 2px na cor de acento (`border-l-2`, largura **sempre reservada**, mesmo inativa, para o texto não deslocar ao ativar) + o mesmo `bg-surface-raised` do hover + peso de fonte (`font-semibold`). Um token como `--color-accent-subtle` resolveria um problema que o app já não tem — e, se entrasse em `@theme inline` sob `--color-*`, cunharia `text-accent-subtle` de graça, o mesmo bug que a D10.1 matou (seção acima). Se um dia um estado selecionado precisar de tint de fundo em vez de borda (ex.: linha de tabela), decide-se então, contra este precedente — não é lacuna hoje.

### Os três níveis de texto separam por peso, nunca por um deles ficar difícil de ler

`--color-text`/`-text-muted`/`-text-faint` formam hierarquia por **peso visual**, não porque o mais fraco dos três é fraco demais para ler — os três precisam bater AA sobre `--color-surface` (`tokens.contrast.test.ts` mede os três). `--color-text-faint` carrega o rótulo de autoria do chat e a dica do `Field`: informação, não decoração — reduzir seu contraste "porque é o nível mais fraco" quebraria um caso de uso real, não só uma escala visual.

### Radius: default é `md`, `lg` é o contêiner primário (correção contra o uso real)

A escala (`sm` 4px, `md` 6px, `lg` 10px, `full` circular) não segue "sm = controle, md = card". Medido: **`md` é o default** (botão, input, linha de lista, item de menu, e qualquer contêiner que não fez escolha própria); **`lg` é o contêiner de superfície primário** (`Panel`, `Dialog`, `Popover`, os três cartões de anexo, `Composer`, bolha de mensagem); **`sm` tem um único consumidor** (`CapabilityChip`) — não há lacuna para um `--radius-xs` de badge, o chip que existiria já usa `sm`; `full` é circular/pílula (`Switch`, `Slider`, dot de status, `Button` circle/spinner).

### Ausências registradas — verificado, sem consumidor hoje

- **`--control-height-xs`.** Botão só-ícone (`shape="circle"`/`"square"`) reusa `sm`/`md`/`lg` via `aspect-square` — não existe um quarto degrau menor.
- **`--duration-instant` (0ms).** Troca de tema não anima nenhum token de cor por transição própria; nada precisa de uma duração explicitamente zero.
- **Escala de `z-index`.** `Dialog` e `Popover` usam a camada superior nativa (`showModal()`, `popover="auto"`), acima de qualquer `z-index` de autor. Uma escala só se justifica se um overlay não nativo aparecer.
- **Breakpoints e estilos de impressão.** App de layout fixo de desktop — zoom muda o viewport efetivo em px CSS, mas não deveria disparar breakpoint; o app não imprime.
- **Espessura de borda.** Sempre 1px (`border`), com 2px como exceção pontual em dois lugares sem relação entre si — a barra de acento (`border-l-2`, ver acima) e o anel do spinner de `Button` (`border-2`). Hairline universal, não tokenizado em nenhum design system de referência.

### Convenções registradas, sem token

- **Alinhamento vertical de controle.** `display: flex; align-items: center` é o default de todo controle (`Button` BASE, linhas de lista, `ContextControl`/`ModelSelector`) — o espaço entre altura do controle e tamanho de fonte é sempre distribuído simetricamente por isso, nunca por padding assimétrico.
- **`line-height`.** `1.5` para corpo/prosa (`body`, `.markdown`), `1.3` para heading de markdown — dois valores, ambos em CSS que não passa por utilitário Tailwind. Tokeniza-se se um terceiro valor ou um consumidor via utility aparecer.
- **`--font-size-xl` (20px) é um degrau sem consumidor hoje**, não uma lacuna — faz parte da escala em camiseta desde a fase 05; fica reservado até que um componente o peça, sem comprometer para qual.
- **Gatilho para nova linha em `tokens.contrast.test.ts`.** Cor de estado nova (inclusive um futuro `--syntax-*` extra) ganha linha na hora em que um componente a usa como texto ou fundo — o registro só sabe da intenção que alguém escreveu à mão, nunca descobre um par novo sozinho.

### `--color-backdrop` e `--syntax-*`: por que ficam de fora do `@theme inline` (detalhe)

`--color-backdrop` é a única camada com alpha do arquivo: carrega transparência de propósito (é a superfície de baixo, esmaecida — um valor opaco seria um segundo fundo, não um véu), tem um único consumidor (`Dialog.module.css`) e não entra em `tokens.contrast.test.ts` porque nada se desenha por cima dele para medir.

`--syntax-*` é um conjunto importado de `@primer/primitives` (D12.4) que **não corresponde nome a nome** ao vocabulário do `highlight.js`: cada token do projeto nomeia o que colore na gramática do `highlight.js`, não como o Primer chama a cor — o `variable` do Primer colore `built_in`/`symbol` aqui, enquanto `.hljs-variable` cai no grupo `constant`; herdar o nome do Primer apontaria para a classe errada. No tema claro há uma divergência deliberada: o Primer funde `entityTag` em `constant` (ambos `#0550ae`), mas o `highlight.js` não funde `name`/`selector-tag` com `attr`/`selector-class` — seguir o Primer à risca pintaria `<div class="x">` com `div` e `class` na mesma cor no claro e cores diferentes no escuro. `--syntax-tag` usa o verde `stringRegexp` do próprio Primer em vez disso, mantendo o par distinto nos dois temas sem sair da paleta.

### Layout da casca: um consumidor real hoje, não três

O par `--sidebar-width`/`--sidebar-width-collapsed` tem hoje **um** consumidor: `Sidebar.tsx`, que lê os dois valores para a largura (expandida/recolhida) e conduz a própria transição (`transition-[width]`) no mesmo elemento — não há um segundo arquivo de transição nem persistência da largura. O plano 13 previu uma "largura persistida pelo plano 14"; o plano 14 decidiu contra isso (D14.7: não existe alça de redimensionar, persistir um booleano seria adiantar metade de uma feature). Se um recurso de redimensionar a sidebar chegar um dia, é ele quem reabre a pergunta.

### `ThinkingMark`: canais de animação, não tokens de design

As 8 variáveis `--thinking-*` (`--thinking-r`, `--thinking-rest-x` etc.) são exceção deliberada à regra "token é valor visual com nome semântico": existem porque o `@utility thinking-dot`/`dotThinking` de `tailwind.css` precisa de um nome para cada valor por ponto que `ThinkingMark.tsx` sobrescreve inline, e ficam em `tokens.css` com default inerte só para que um typo no par falhe alto (`guard.mjs` guarda 7) em vez de renderizar nada.
