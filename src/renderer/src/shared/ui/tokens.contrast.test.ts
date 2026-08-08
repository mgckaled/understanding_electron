/*
 * Contrast audit as an invariant. See docs/plan/*\/10-cor-contraste-e-tema-claro.md.
 *
 * Three parts, each small on purpose:
 *   1. WCAG 2.1 relative luminance and contrast ratio — 15 lines of arithmetic
 *      from a spec stable since 2008, not worth a dependency (D10.4).
 *   2. A reader of tokens.css that resolves a chain of `var()` down to a `#hex`,
 *      for the `:root` (dark) block and the `@media (prefers-color-scheme: light)`
 *      block separately, the second layered over the first.
 *   3. A hand-written registry of the pairs that must clear the AA threshold.
 *
 * Why the registry is hand-written: no static analysis of tokens.css knows that
 * `--color-warn` is used as *text* over `--color-surface` — that lives in the
 * component CSS. The registry is where each token's intent is declared: the row
 * `['--color-warn-text', '--color-surface', 4.5]` asserts that token exists to
 * be text.
 *
 * Rows carry the full token name rather than a bare suffix: the `--syntax-*`
 * family (D12.4) is not under the `--color-` prefix, and a registry that can
 * only express one prefix would have needed a second copy of this whole file.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// --- 1. WCAG 2.1 contrast ---------------------------------------------------

/** Relative luminance of a 6-digit `#rrggbb` colour, per WCAG 2.1. */
function relativeLuminance(hex: string): number {
  const digits = hex.replace('#', '')
  const channel = (offset: number): number => {
    const srgb = parseInt(digits.slice(offset, offset + 2), 16) / 255
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
}

/** Contrast ratio between two colours, in the range 1:1 to 21:1. */
function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)]
  const [lighter, darker] = l1 >= l2 ? [l1, l2] : [l2, l1]
  return (lighter + 0.05) / (darker + 0.05)
}

// --- 2. tokens.css reader ---------------------------------------------------

/** Every `--name: value;` declaration inside a CSS block. */
function declarationsIn(block: string): Map<string, string> {
  const declarations = new Map<string, string>()
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    declarations.set(match[1], match[2].trim())
  }
  return declarations
}

/** Follows a `var()` chain until a literal value (a `#hex`), or undefined. */
function resolveToken(token: string, tokens: Map<string, string>): string | undefined {
  let value = tokens.get(token)
  const seen = new Set<string>()
  while (value !== undefined && value.startsWith('var(')) {
    const next = value.match(/var\(\s*(--[\w-]+)/)?.[1]
    if (next === undefined || seen.has(next)) return undefined
    seen.add(next)
    value = tokens.get(next)
  }
  return value
}

// Resolve from cwd, not import.meta.url: under the jsdom environment Vitest gives
// this module an http: URL, so fileURLToPath throws. Every entry point of this
// project runs from the repo root (check:fast, and the hooks via runBin's
// cwd: REPO_ROOT), which is the anchor this path relies on.
const TOKENS_CSS = resolve(process.cwd(), 'src/renderer/src/shared/ui/tokens.css')

// Strip block comments first: format_fix runs Prettier on tokens.css after every
// edit, so the exact byte layout is not ours to control, and a `;` or `}` inside
// a comment must not confuse the declaration regex. Same precedent as guard.mjs.
const css = readFileSync(TOKENS_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// The base `:root` is the first one in the file; the light `:root` is nested in
// the `@media` block. Dark reads the base alone; light layers its overrides on top.
const baseBlock = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? ''
const lightBlock =
  css.match(/@media[^{]*prefers-color-scheme:\s*light[^{]*\{\s*:root\s*\{([^}]*)\}/)?.[1] ?? ''

const base = declarationsIn(baseBlock)
const darkTokens = base
const lightTokens = new Map([...base, ...declarationsIn(lightBlock)])

// --- 3. Pair registry -------------------------------------------------------

const PAIRS = [
  ['--color-text', '--color-surface', 4.5],
  ['--color-text-muted', '--color-surface', 4.5],
  ['--color-text-faint', '--color-surface', 4.5],
  ['--color-accent-text', '--color-surface', 4.5],
  ['--color-danger-text', '--color-surface', 4.5],
  ['--color-warn-text', '--color-surface', 4.5],
  ['--color-ok-text', '--color-surface', 4.5],
  ['--color-on-accent', '--color-accent', 4.5],
  ['--color-on-accent', '--color-accent-hover', 4.5],
  ['--color-on-danger', '--color-danger', 4.5],
  // Syntax palette (D12.3): every token sits on --color-surface-sunken, which
  // is the code block's surface. These are imported from @primer/primitives
  // rather than from the theme highlight.js ships, whose light `keyword` and
  // `built_in` are stale enough to fail this very threshold.
  ['--syntax-keyword', '--color-surface-sunken', 4.5],
  ['--syntax-entity', '--color-surface-sunken', 4.5],
  ['--syntax-constant', '--color-surface-sunken', 4.5],
  ['--syntax-string', '--color-surface-sunken', 4.5],
  ['--syntax-builtin', '--color-surface-sunken', 4.5],
  ['--syntax-comment', '--color-surface-sunken', 4.5],
  ['--syntax-tag', '--color-surface-sunken', 4.5]
] as const

const THEMES = [
  ['escuro', darkTokens],
  ['claro', lightTokens]
] as const

// Comma decimal to match the audit's own notation (2,56:1) — the reader of a
// failure is a Portuguese-speaking developer without this audit at hand.
const ratioText = (n: number): string => n.toFixed(2).replace('.', ',')
const minText = (n: number): string => String(n).replace('.', ',')

for (const [themeName, tokens] of THEMES) {
  describe(`contraste — tema ${themeName}`, () => {
    for (const [foreground, background, minimum] of PAIRS) {
      it(`${foreground} sobre ${background} atinge ${minText(minimum)}:1`, () => {
        const fg = resolveToken(foreground, tokens)
        const bg = resolveToken(background, tokens)
        if (fg === undefined || bg === undefined) {
          const missing = fg === undefined ? foreground : background
          throw new Error(`${missing} não resolve para um #hex em tokens.css`)
        }
        const ratio = contrastRatio(fg, bg)
        expect(
          ratio,
          `${foreground} ${fg} sobre ${background} ${bg} = ${ratioText(ratio)}:1, ` +
            `mínimo ${minText(minimum)}`
        ).toBeGreaterThanOrEqual(minimum)
      })
    }
  })
}
