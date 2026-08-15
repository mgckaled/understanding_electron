# Brief para o Claude Design — camada Tailwind v4 sobre o design system do crivo

**ago/2026.** Motivado pela decisão de adotar o Tailwind v4 sem meia migração, tomada quando os protótipos gerados pela ferramenta Claude Design tornaram concreta a pergunta que a D5.1 tinha deixado em aberto desde a fase 05.

> **O que este documento é.** O texto abaixo, do `---` em diante, é para ser colado como prompt na ferramenta Claude Design. Ele contém **apenas** o que precisa chegar até lá: as restrições que os componentes e o guia entregues precisam respeitar.
>
> **O que ficou de fora, de propósito**, porque é trabalho deste repositório e não dele: configuração do `electron.vite.config.ts`, instalação e `allowBuilds` do pnpm, o ramo `.tsx` do `guard.mjs`, o `tokens.contrast.test.ts`, o `prettier-plugin-tailwindcss`, a régua de tamanho e a ordem de migração. Isso vira plano em `docs/plan/active/`, a partir do guia que ele devolver.
>
> Motivo das decisões que o brief impõe: [`HISTORY.md`](../HISTORY.md) § *Tailwind v4 entra*.

---

## Contexto

App Electron de desktop chamado **crivo** — uma bancada local de dados operada por conversa. Renderer em React 19 + TypeScript sobre Vite 7. Uso pessoal, um usuário, Windows.

Já existe um design system implementado, com tokens em CSS custom properties e cinco primitivos em CSS Modules. **A tarefa é produzir o guia e os componentes com uma camada Tailwind CSS v4 sobre esse sistema** — lendo os tokens que já existem, não propondo novos.

## Versão e modelo mental

- **Tailwind CSS v4** (4.3.3 ou mais recente). Não v3.
- Configuração é **CSS-first**: não existe `tailwind.config.js`. Tudo em `@theme` / `@utility` dentro do CSS.
- O guia deve assumir o plugin `@tailwindcss/vite`.

## Restrição 1 — usar `@theme inline`, nunca `@theme`

O arquivo de tokens do projeto declara valores em `:root` e redefine a camada semântica dentro de `@media (prefers-color-scheme: light) { :root { … } }`.

**Essa estrutura não pode ser alterada.** Dois motivos:

1. A especificação do v4 proíbe variável de tema dentro de `@media` — variáveis de `@theme` só existem no nível superior.
2. Há um audit automatizado de contraste que lê esse arquivo, resolve cada `var()` até o `#hex` e mede WCAG AA nos dois temas. Reestruturar o arquivo derruba o audit.

Portanto os tokens ficam onde estão, e o `@theme inline` apenas mapeia nomes para `var()` dos tokens existentes. **O Tailwind é consumidor do arquivo de tokens, não dono dele:**

```css
@import 'tailwindcss';

/* :root e @media continuam exatamente como já estão */

@theme inline {
  --color-*: initial;
  --spacing: initial;
  --text-*: initial;
  --radius-*: initial;

  --color-surface: var(--color-surface);
  --spacing-6: var(--space-6);
  --text-reading: var(--font-size-reading);
  /* … */
}
```

## Restrição 2 — todos os defaults do Tailwind desligados

Nenhuma classe da paleta ou da escala padrão pode existir. `bg-slate-800`, `text-gray-400` e `p-4` valendo 16px devem **falhar em compilar**. Só existe o que vem dos tokens abaixo.

## Os tokens do projeto

Nomes exatos, já em uso. Não renomear, não inventar, não acrescentar.

**Cor semântica** — `--color-` + : `bg`, `surface`, `surface-raised`, `surface-sunken`, `border`, `border-strong`, `text`, `text-muted`, `text-faint`, `backdrop`, `accent`, `accent-hover`, `on-accent`, `accent-text`, `danger`, `on-danger`, `danger-text`, `warn`, `warn-text`, `ok`, `ok-text`. Mais a família `--syntax-*` (7 tokens, realce de código: `keyword`, `entity`, `constant`, `string`, `builtin`, `comment`, `tag`).

**Espaço** — escala **nomeada, não multiplicativa**. `--space-1` a `--space-9` = `2, 4, 6, 8, 12, 16, 24, 32, 48` px. Mapear para `--spacing-1..9`, de modo que `p-1` seja 2px e `p-6` seja 16px. **Não adotar a escala 4px-multiplicativa do Tailwind** — a calibração é de aplicativo de desktop, onde a densidade é maior que na web.

**Tipografia** → namespace `--text-*`: `2xs`=11, `xs`=12, `sm`=13, `md`=14, `lg`=16, `xl`=20, `2xl`=28, e `reading`=18.

**Raio**: `sm`=4, `md`=6, `lg`=10, `full`=9999.
**Altura de controle**: `sm`=24, `md`=28, `lg`=34. **Linha de tabela**: 28.
**Duração**: `fast`=120ms, `base`=200ms, `slow`=320ms.
**Fonte**: `--font-ui` (`'Segoe UI Variable', 'Segoe UI', system-ui, …`) e `--font-mono`
(`'JetBrains Mono', ui-monospace, 'Cascadia Code', Consolas, …` — JetBrains Mono
auto-hospedada via `@fontsource`, DS5.2; a pilha do sistema segue como *fallback*).
**Layout da casca**: `--sidebar-width`=264px, `--sidebar-width-collapsed`=44px.

## Restrição 3 — cor de estado tem duas formas, e uma delas não pode virar texto

Uma cor escura o bastante para carregar texto branco como **fundo** e uma cor clara o bastante para ser legível como **texto** sobre superfície são cores diferentes. Usar a primeira como texto produziu 2,96:1 neste projeto — foi um bug real, medido e corrigido.

A regra em vigor:

| Papel | Token | Onde se aplica |
|---|---|---|
| Preenchimento sólido | `--color-accent`, `--color-danger`, `--color-warn`, `--color-ok` | **apenas** `background` e `accent-color` |
| Rótulo sobre esse sólido | `--color-on-accent`, `--color-on-danger` | `color`, dentro de um elemento de fundo sólido |
| Texto, borda, outline sobre superfície | `--color-accent-text`, `--color-danger-text`, `--color-warn-text`, `--color-ok-text` | `color`, `border-color`, `outline` |

**Problema a resolver no guia:** a namespace `--color-*` do Tailwind é tudo-ou-nada — declarar `--color-accent` gera `bg-accent` **e** `text-accent`, e a segunda é exatamente a violação acima.

**Solução pedida:** os quatro sólidos ficam **fora** do `@theme inline` e recebem só a utilidade que a regra permite, via `@utility`:

```css
@utility bg-accent { background-color: var(--color-accent); }
@utility bg-accent-hover { background-color: var(--color-accent-hover); }
@utility bg-danger { background-color: var(--color-danger); }
@utility bg-warn { background-color: var(--color-warn); }
@utility bg-ok { background-color: var(--color-ok); }
```

Resultado: `bg-accent` compila, `text-accent` **não existe**. As variantes `-text` e `on-` entram normalmente no `@theme inline`, porque são seguras em qualquer propriedade.

## Restrição 4 — proibições no JSX

- **Zero** valor arbitrário com cor literal: nada de `bg-[#ff0000]`, `text-[#abc]`, `border-[#333]`.
- **Zero** `style={{ color: '…' }}` com literal.
- **Zero** classe da paleta padrão (elas não devem nem compilar).
- Toda cor, espaço, raio, duração e tamanho vem de token.
- Exceção única: espessura de borda de 1–2px — hairline universal que nenhum design system tokeniza.

## Tema: sistema operacional decide, sem alternador

> ⚠️ **Revertido em ago/2026 (DS-4, DS4.2), a pedido explícito do usuário.** O texto
> abaixo é o prompt que de fato foi colado na ferramenta nesta sessão — preservado
> por ser o registro do que foi pedido, não a decisão em vigor. **A decisão atual:**
> `AppSettings.theme` (`system`/`light`/`dark`) com alternador segmentado em
> Configurações. O mecanismo não contradiz o parágrafo abaixo tanto quanto parece —
> `nativeTheme.themeSource` setado no main já propaga `prefers-color-scheme` para o
> renderer, então **`tokens.css` continua sem `data-theme` e sem uma linha mudada**;
> só ganhou um emissor a mais (o main, via IPC) além do SO. Ver skill `design-system`
> § Tema e `docs/HISTORY.md`.

- **Não** usar `data-theme` no `<html>`.
- **Não** usar a variante `dark:` do Tailwind.
- O tema claro já funciona pela redefinição em `@media (prefers-color-scheme: light)` dentro do arquivo de tokens, e com `@theme inline` isso propaga sozinho para todas as utilidades.

Se os protótipos já tiverem sido gerados com `data-theme`, converter para `prefers-color-scheme` — o app não tem, e não vai ter, alternador manual.

## Duas densidades — não unificar

| Densidade | Corpo | Quem |
|---|---|---|
| **Chrome** — compacta | `text-sm` (13px) | sidebar, nav, rodapé, cabeçalho, toolbar, modal, controles do composer |
| **Leitura** — generosa | `text-reading` (18px) | mensagem do usuário, resposta do assistente, artefatos, o texto que se digita no composer |

O critério não é importância, é **quanto tempo o olho fica ali**: chrome se escaneia; resposta de modelo se lê por um minuto seguido, e 13px cansa nessa duração.

Título dentro de superfície de leitura é proporcional ao tamanho de leitura (`em` relativo), não à escala de chrome.

## O que não deve virar utilidade

**1. A camada base de comportamento de desktop** → `@layer base`, preservando:
`user-select: none` na raiz mais uma classe `.selectable` para o que é copiável (caminho, célula, mensagem de erro); `overscroll-behavior: none`; estilo de scrollbar fina; `:focus { outline: none }` com `:focus-visible { outline: 2px solid var(--color-accent-text) }` — o anel só aparece quando o teclado foi usado, nunca no clique; e o bloco `prefers-reduced-motion` zerando durações.

App de desktop não é página web. Essas são as diferenças que, descobertas tarde, custam uma varredura por todo componente já escrito.

**2. A tipografia do markdown renderizado.** O app renderiza respostas do modelo via `react-markdown`, que gera HTML **sem `className` onde pendurar utilidade**. Essa folha continua em CSS. Não tentar `@apply` em massa ali, e não propor plugin de typography.

**3. O modal.** O `Dialog` do projeto é o elemento `<dialog>` nativo com `showModal()` e `closedby="any"`. Camada superior, foco preso, `Esc`, foco devolvido ao gatilho e `::backdrop` estilizável vêm da plataforma, verificados no Chromium 148. **Não substituir por `<div>` com overlay, nem propor biblioteca de primitivos** (Radix, Ark, Headless UI) — a decisão de não usá-las está tomada. Estilizar por utilidade é bem-vindo; trocar o elemento, não.

## Convenções de código

- Identificadores, comentários e nomes de arquivo **sempre em inglês**. Português só em texto visível ao usuário.
- Onde uma classe repete ou varia por estado (`variant`, `size`, `loading`), extrair as variantes para constante fora do JSX — objeto de strings ou `cva`. Onde é layout com 3–4 classes, deixar inline.
- Comentário diz o que o código não consegue dizer, em até ~3 linhas. Razão longa não vai no fonte.
- Componentes funcionais recebem `ref` como prop comum (React 19) — não usar `forwardRef`.

## Entregável

1. **Guia** de como a camada Tailwind se assenta sobre estes tokens: o bloco `@theme inline` completo, os `@utility` dos sólidos, e as regras de uso acima em forma consultável.
2. **Componentes** com as classes já aplicadas, respeitando as restrições.
3. **Lista do que ficou em CSS e por quê** — separando o que é limite físico (conteúdo gerado, pseudo-elemento, keyframe) do que é escolha.
