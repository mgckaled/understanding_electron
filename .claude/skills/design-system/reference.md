# Design system — inventário de referência

Consulta rara, deliberadamente fora do [`SKILL.md`](SKILL.md): nada aqui decide a primeira linha de um componente. Responde a outra pergunta — *"por que não existe um token para isto?"* — e a resposta quase sempre é **um único consumidor não justifica um terceiro nível**.

> Toda a narrativa de decisão que antes vivia em comentário dentro de `base.css`/`tailwind.css` mora aqui; os dois arquivos citam este documento no topo. Só um aviso sobrevive como linha solta no fonte, porque violá-lo é catastrófico e não é adivinhável: **`tokens.css` nunca entra num `@layer`** (DS1.5).

---

## Fundação de `base.css` e `tailwind.css` (DS-6)

**`@layer base`** — o arquivo inteiro cai na mesma camada do preflight do Tailwind, perdendo de qualquer utilitário sem disputa de especificidade; `@layer utilities` vem depois, em `main.tsx`.

**Duas correções ao preflight**, medidas, não adivinhadas: `* { margin: 0 }` leva o `dialog { margin: auto }` do navegador junto, e o modal cai em `0,0` em vez de centrado; `font: inherit` em controles troca `line-height: normal` por `1.5`, movendo cada rótulo 1px. `option`/`meter`/`::placeholder` revertem ao chrome nativo pelo mesmo motivo — padding do popup do dropdown, o `<meter>` do orçamento de contexto, cor de placeholder — e adotar qualquer um deles é decisão própria, não efeito colateral do reset.

**`tailwind.css` é arquivo próprio, nunca fundido em `tokens.css`** (DS1.1): `tokens.css` precisa continuar byte-idêntico para `tokens.contrast.test.ts` provar contraste contra ele, e as declarações `@theme inline` são ciclos que se referenciam pelo próprio nome (`--color-bg: var(--color-bg)`) — ciclo que só funciona porque declaração fora de `@layer` vence declaração dentro dele. Juntar os arquivos injetaria esses ciclos no arquivo que o teste lê.

**`@theme inline`** carrega `inline` porque todo valor é um `var()` para dentro de `tokens.css`: a utilidade precisa carregar a própria referência, senão o `@media` do tema claro não alcançaria o valor novo.

**`--color-*`/`--spacing-*`/`--text-*`/`--radius-*`/`--font-*: initial`** desligam o default do Tailwind de propósito — um `bg-slate-800` ou um `p-4` de 4px sobrevivendo seria um segundo lugar decidindo cor e densidade. **Medido, porque o palpite vai na direção contrária:** `--font-*: initial` **não** leva `--font-weight-*` junto — `font-bold` sobrevive; ele mata `font-sans`/`font-serif`, que competiriam com `--font-ui`.

**As solid fills (`bg-accent`, `bg-accent-hover`, `bg-danger`, `bg-warn`, `bg-ok`)** existem porque o namespace `--color-*` é tudo-ou-nada: declarar `--color-accent` em `@theme inline` também cunharia `text-accent`, o mesmo bug de 2,96:1 que a D10.1 matou. Como `@utility`, só o fill existe — o errado não é escrevível. Variantes funcionam nelas, então o hover do `Button` é `hover:bg-accent-hover`.

**`animate-spinner`** tem nome próprio em vez do `animate-spin` do Tailwind porque aquele é travado em 1s e o deste projeto é `--duration-slow` (320ms) — `duration-*` seta `transition-duration`, nunca `animation-duration`. As `@keyframes` ficam fora do `@utility` porque ele não pode conter at-rule.

**`responding-dot`/`dotResponding`/`animate-responding-dot`** são os 14 pontos do `RespondingMark` (renomeado de `ThinkingMark` no 21-A, D21A.4 — a marca é uma só, atravessa raciocínio e resposta): um keyframe único, parametrizado por custom properties que `RespondingMark.tsx` seta inline por ponto. Adicionado e removido ponto a ponto, na fronteira de `animationiteration` daquele ponto — nunca os 14 de uma vez, porque `--responding-dot-delay` escalona quando cada um volta ao repouso. ⚠️ **`0%`/`100%` do `dotResponding` precisam bater exatamente com a posição de repouso de `responding-dot`**: `prefers-reduced-motion` força uma única iteração de `0.01ms`, que pousa onde `0%`/`100%` apontarem — divergir congela a marca fora de forma para quem usa movimento reduzido.

### Comportamento de desktop que faltava

- **`color-scheme` por tema.** Sem ele, o Chromium renderiza controle nativo (`<meter>`, `<option>`, scrollbar de sistema) no esquema padrão — visível de imediato, porque são exatamente os três seletores que o preflight já devolve ao chrome nativo. Casa com a mesma `@media (prefers-color-scheme)` de `tokens.css`, então segue `nativeTheme.themeSource` sem tocar componente.
- **`forced-colors: active`.** O Windows High Contrast Mode substitui cor de autor por cor de sistema (`ButtonText`/`Highlight` — cores de sistema CSS, não tokens do projeto); sem tratamento, controle interativo pode perder contorno visível. Verificado ao vivo com um tema de contraste do Windows ligado.
- **`overflow-wrap: break-word` no `body`.** Caminho de arquivo do Windows, hash, id de modelo: string longa sem espaço quebra em vez de estourar o container. Quem precisa de outro comportamento (bloco de código) define o próprio `white-space`. **Não alcança célula de tabela de dado** (`DatasetTable`/`DatasetQueryPanel`, onde `whitespace-nowrap` vence) — medido ao vivo: a célula continua uma linha rolando horizontal dentro do `overflow-auto`, exatamente como antes.
- **Autofill do Chromium neutralizado.** O `box-shadow` inset usa `--color-surface-sunken` — "interior de campo", o mesmo token que `ConversationList` e `CloudSecrets` já usam em `bg-surface-sunken` nos inputs reais, não `--color-surface`, que é a superfície ao redor. `transition: background-color 9999s` impede a animação de fundo do autofill sem recorrer a `!important`.
- **`caret-color: var(--color-accent-text)`.** Mesmo token do anel de foco e do link.
- **`-webkit-user-drag: none` em `img`/`svg`/`video`.** Evita o drag fantasma do SO. Sem `user-select: none` junto — já herda de `html`.
- **`img { display: block; max-width: 100% }`.** Imagem é `inline` por padrão, o que cria o espaço de baseline abaixo ("gap fantasma"). **Medido ao vivo**, não assumido: no único consumidor real (`ImageCard`, 180×140) a diferença de altura entre `inline` e `block` é **zero** — o gap só aparece quando a imagem é menor que a linha de texto ao redor. `MarkdownMessage` não conta como segundo consumidor: `urlTransform` zera todo `src` de imagem markdown sob o CSP `img-src 'self' data:` (D11.2).

### Robustez e consistência

- **`::selection`** usa `color-mix(in oklab, var(--color-accent-text) 30%, transparent)` — cor da paleta em vez do default do SO. Funciona nos dois temas porque `--color-accent-text` já é redefinido no claro. Sem token novo. ⚠️ **Contraste verificado ao vivo nos dois temas** — `tokens.contrast.test.ts` só resolve pares escritos à mão, e a saída de um `color-mix()` não está nessa lista.
- **Números tabulares são convenção, não regra global.** Superfície de dados deve usar a utilidade `tabular-nums` do próprio Tailwind (declaração estática, sem `var()`, então não interage com os resets `--font-*`/`--text-*: initial`). Não é regra do `body` porque número tabular em prosa corrida fica menos legível — a aplicação é por componente de dado. **Em tabela de dados vem acompanhado de `text-right`** (F-3-D): número à direita e texto à esquerda é o que permite comparar magnitude sem ler. Qual coluna é numérica sai da primeira célula não-nula (`numericColumns`, em `features/attachment/formatCell.ts`), não de um schema — as três tabelas de dados chegam ao mesmo formato por rotas diferentes.
- **Tokens fora de `@theme inline`.** `--duration-*`, `--control-height-*`, `--table-row-height`, `--sidebar-width*` e o canal `--thinking-*` são consumidos por referência direta a `var()` (`duration-(--duration-fast)`, `h-(--control-height-sm)`), não por nome mapeado — não têm consumidor no formato nomeado que justificaria a entrada. Além deles, dois semânticos ficam de fora por ter um único consumidor fora do Tailwind: `--color-backdrop` e `--syntax-*` (detalhe abaixo).
- **`:disabled` é decisão por componente, não regra global.** Cada componente trata o próprio estado (`disabled:opacity-50`, `disabled:cursor-not-allowed` no `Button`) porque a intensidade do esmaecimento depende da superfície do controle.

### Estado atual, sem registro escrito antes

- **Sem media query de largura.** Layout fixo de desktop — zoom muda o viewport efetivo em px CSS, mas não deveria disparar breakpoint. Se um dia for necessária, é decisão a tomar então, não ausência a corrigir.
- **`text-rendering: optimizeLegibility` + `-webkit-font-smoothing: antialiased`** no `body` são escolha deliberada de desktop, não default copiado sem pensar.
- **O reset global de `ul`** (`list-style: none; padding: 0`) tira marcador de toda lista; `MarkdownMessage.module.css` restaura `list-style`/`padding-left` para markdown renderizado. Outra superfície que precise de lista opta de volta por conta própria.
- **A scrollbar usa `--color-border-strong`**, sem token dedicado — um único consumidor. Extrair `--color-scrollbar` só se um segundo aparecer ou a cor precisar divergir.
- **`::backdrop` é por componente**, hoje só `Dialog.module.css`. Sem regra global.
- **Não existe hover para `danger`/`warn`/`ok`** porque `tokens.css` não declara `--color-danger-hover`/`--color-warn-hover`/`--color-ok-hover` — só `--color-accent-hover` existe. Se precisar, o token nasce primeiro, a utilidade depois.
- **`ease-initial` é palavra-chave do Tailwind (`ease`), não token.** `tokens.css` não declara nenhum `--ease-*`; `Button`, `Switch` e `Sidebar` usam a palavra-chave embutida.

---

## Ausências registradas — verificado, sem consumidor hoje (DS-7)

- **`--color-accent-subtle` ou qualquer token de tint.** Hover sobe um degrau na escada e seleção é borda + fundo + peso (regra no `SKILL.md`) — um token de tint resolveria um problema que o app não tem, e sob `--color-*` cunharia `text-accent-subtle` de graça, o bug da D10.1. Se um dia um estado selecionado precisar de tint (ex.: linha de tabela), decide-se **contra este precedente**.
- **`--radius-xs` de badge.** `sm` tem um único consumidor (`CapabilityChip`) — o chip que existiria já usa `sm`.
- **`--control-height-xs`.** Botão só-ícone (`shape="circle"`/`"square"`) reusa `sm`/`md`/`lg` via `aspect-square`.
- **`--duration-instant` (0ms).** Troca de tema não anima nenhum token por transição própria.
- **Escala de `z-index`.** `Dialog` e `Popover` usam a camada superior nativa, acima de qualquer `z-index` de autor. Só se justifica se um overlay não nativo aparecer.
- **Breakpoints e estilos de impressão.** Layout fixo de desktop; o app não imprime.
- **Espessura de borda.** Sempre 1px, com 2px em dois lugares sem relação entre si — a barra de acento (`border-l-2`) e o anel do spinner de `Button` (`border-2`). Hairline universal, não tokenizado em nenhum design system de referência.
- **`--font-size-xl` (20px) é um degrau sem consumidor hoje**, não uma lacuna — parte da escala em camiseta, reservado sem comprometer para qual.

## Convenções registradas, sem token

- **Alinhamento vertical de controle.** `display: flex; align-items: center` é o default de todo controle (`Button` BASE, linhas de lista, `ContextControl`/`ModelSelector`) — o espaço entre altura do controle e tamanho de fonte é sempre distribuído simetricamente por isso, nunca por padding assimétrico.
- **`line-height`.** `1.5` para corpo/prosa (`body`, `.markdown`), `1.3` para heading de markdown — dois valores, ambos em CSS que não passa por utilitário. Tokeniza-se se um terceiro valor ou um consumidor via utility aparecer.

## `--color-backdrop` e `--syntax-*`: por que ficam de fora do `@theme inline`

`--color-backdrop` é a única camada com alpha do arquivo: carrega transparência de propósito (é a superfície de baixo, esmaecida — um valor opaco seria um segundo fundo, não um véu), tem um único consumidor (`Dialog.module.css`) e não entra em `tokens.contrast.test.ts` porque nada se desenha por cima dele para medir.

`--syntax-*` é um conjunto importado de `@primer/primitives` (D12.4) que **não corresponde nome a nome** ao vocabulário do `highlight.js`: cada token do projeto nomeia o que colore na gramática do `highlight.js`, não como o Primer chama a cor — o `variable` do Primer colore `built_in`/`symbol` aqui, enquanto `.hljs-variable` cai no grupo `constant`; herdar o nome do Primer apontaria para a classe errada. No tema claro há uma divergência deliberada: o Primer funde `entityTag` em `constant` (ambos `#0550ae`), mas o `highlight.js` não funde `name`/`selector-tag` com `attr`/`selector-class` — seguir o Primer à risca pintaria `<div class="x">` com `div` e `class` na mesma cor no claro e cores diferentes no escuro. `--syntax-tag` usa o verde `stringRegexp` do próprio Primer, mantendo o par distinto nos dois temas sem sair da paleta.

## `RespondingMark`: canais de animação, não tokens de design

As 8 variáveis `--responding-*` (`--responding-r`, `--responding-rest-x` etc.) são exceção deliberada à regra "token é valor visual com nome semântico": existem porque o `@utility responding-dot`/`dotResponding` precisa de um nome para cada valor por ponto que `RespondingMark.tsx` sobrescreve inline, e ficam em `tokens.css` com default inerte só para que um typo no par falhe alto (`guard.mjs` guarda 7) em vez de renderizar nada.

## `animate-pulse-warn`: pulso de estado, cor sempre do token semântico

`ReasoningDisclosure.tsx` (21-B) pulsa o ícone `Lightbulb` enquanto o modelo está na fase "pensando", mesmo com o card fechado — precedente de "indicador de estado ativo" fora do `RespondingMark`. `--duration-warn-pulse-cycle: 1200ms` é um token de ciclo one-off, mesma categoria de `--duration-responding-cycle` (não uma das três durações genéricas `fast`/`base`/`slow` — pedido explícito era um pulso "bastante perceptível", mais rápido que os 2400ms do monograma). `@keyframes pulseWarn`/`@utility animate-pulse-warn` (`tailwind.css`) variam só `opacity` (1 → 0,25 → 1) — a cor em si nunca muda, é sempre `text-warn-text` (o token semântico de aviso, já testado para contraste em `tokens.contrast.test.ts`); "apagado" (fora da fase de pensar) é `text-text-faint` estático, ícone sempre montado para não perder o sinal de "isto teve raciocínio" quando o card recolhe. `prefers-reduced-motion` não precisa de tratamento extra — a regra global do `base.css` já zera `animation-duration`.

## Layout da casca: um consumidor real, não três

O par `--sidebar-width`/`--sidebar-width-collapsed` tem **um** consumidor: `Sidebar.tsx`, que lê os dois valores para a largura (expandida/recolhida) e conduz a própria transição (`transition-[width]`) no mesmo elemento — não há segundo arquivo de transição nem persistência da largura. O plano 13 previu uma "largura persistida pelo plano 14"; o 14 decidiu contra (D14.7: não existe alça de redimensionar, persistir um booleano seria adiantar metade de uma feature). Se um recurso de redimensionar chegar, é ele quem reabre a pergunta.

## Animar para altura automática: `calc-size(auto, size)`, sem opt-in global

`ReasoningDisclosure.tsx` (21-B) é o primeiro consumidor no projeto. `height: calc-size(auto, size)` aplica `interpolate-size: allow-keywords` **escopado ao próprio valor** (confirmado na MDN) — não precisa de `:root { interpolate-size: allow-keywords }`, que ligaria interpolação de palavra-chave para qualquer elemento do app animando para uma keyword intrínseca, efeito colateral difícil de auditar. Suporte desde Chromium 129 (set/2024); o app roda em Chromium 148 embutido — sem fallback, mesmo critério do `field-sizing: content` do `Composer.tsx`. Duração e *timing function* seguem a convenção normal (`duration-(--duration-base)` + `ease-initial`), nenhum token novo. **Se um segundo consumidor precisar do mesmo, reaproveite a classe, não a pesquisa.**

## Layout da casca: um consumidor real, não três

Nenhuma promovida a token, mesmo critério de sempre: um único consumidor não justifica um terceiro nível.

- **`Switch`** (`18px`/`32px` de trilho, `14px` de thumb). Único consumidor (`AttachButton`, três instâncias do mesmo desenho). `--control-height-*` não serve — é para controle de formulário com rótulo ao lado, não para geometria interna trilho/thumb.
- **`Dialog`** (`420px` de largura, `min(640px, 85vh)` de altura máxima). Documentado no próprio `Dialog.module.css`.

**Se um segundo consumidor real de qualquer um desses aparecer com a mesma medida, é esse o gatilho para promover** — não a existência do valor em si.

## CSS Modules no Vite: nomes de classe saem exatamente como escritos

Funciona sem configuração (arquivo terminado em `.module.css`), e **sem conversão automática para camelCase** — por isso as classes já nascem em camelCase no `.module.css`, para acesso direto via `styles.algumaCoisa`. Vale para os três componentes que ficam em CSS Modules por limite físico (`Dialog`, `Popover`, `MarkdownMessage` — ver [`SKILL.md`](SKILL.md)).
