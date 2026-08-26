#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook: enforce crivo hard invariants.
 *
 * Port of `guard.py` from the mill.tools project. Inspects the file that was
 * just edited for regressions that either cannot be expressed in ESLint, or
 * are severe enough to deserve a second, louder net.
 *
 * Guards, in descending order of damage-if-violated:
 *
 *   1. SECURITY REGRESSION — `sandbox: false`, `contextIsolation: false`,
 *      `nodeIntegration: true` or `webSecurity: false` under src/main/. The
 *      one that matters most: it is configuration nobody revisits, it breaks
 *      nothing visible when reintroduced, and it silently removes the process
 *      boundary the whole architecture rests on.
 *
 *   2. IPC REGISTRY BYPASS — `ipcMain` outside src/main/ipc/. A bare handler
 *      skips zod validation and is unreachable from the level-3 tests.
 *
 *   3. CONTEXTBRIDGE SURFACE — `exposeInMainWorld` with any key but 'api'.
 *      The renderer gets exactly one domain-shaped surface (ISP).
 *
 *   4. SECRET LEAK — `process.env` or `import.meta.env` inside src/renderer/.
 *      There is no `process` there under sandbox, and Vite statically inlines
 *      any `VITE_*` value into the built bundle — the two ways a renderer
 *      leaks a secret. Relevant since the AI layer (Ollama/Gemini/GLM) landed.
 *
 *   5. LAYER PURITY — `electron` imported from src/core/ or src/shared/.
 *      Redundant with ESLint by design: this fires on every edit, whereas
 *      lint only runs when invoked.
 *
 *   6. HARDCODED DESIGN VALUE — hex colour in a *.module.css, in the Tailwind
 *      theme layer, or in base.css (DS-6). ESLint does not lint CSS, so the
 *      token rule has no automated enforcement otherwise.
 *
 *   7. UNKNOWN TOKEN — `var(--x)` with no matching declaration in tokens.css.
 *      Catches the typo that renders as "no style at all" and is invisible
 *      until someone looks at that exact component. Since DS-1 it also covers
 *      assets/tailwind.css, where one wrong name in `@theme inline` silently
 *      kills a utility family everywhere; since DS-6, also base.css.
 *
 *   8. LITERAL COLOUR OR PRIMITIVE IN JSX — arbitrary colour value
 *      (`bg-[#0d5bd9]`, `text-[rgb(…)]`), a primitive reached through the v4
 *      shorthand (`bg-(--gray-3)`), or a literal inside `style={{ }}`, in a
 *      .tsx under src/renderer/. This is the half that compilation does not
 *      cover: `--color-*: initial` kills `bg-slate-800` at build time, and
 *      arbitrary values are exactly what survives it. Written in DS-1 step 3,
 *      deliberately BEFORE the migration — a guard written afterwards is
 *      calibrated not to fail the code that already exists.
 *
 *   9. NARRATIVE BLOCK COMMENT — a `/*`-style block comment in a .ts/.tsx that
 *      is not a `/**` doc-comment, not a directive (eslint, ts-, __PURE__…) and
 *      not a JSX comment. The flooding symptom the `comments` skill bans:
 *      narrative goes in `//` (≤3 lines) or a `/**` docstring, and long
 *      rationale in HISTORY.md by decision id. Added by R-1.
 *
 *  10. LINE CEILING — src/main/index.ts and src/preload/index.ts past the
 *      100-line "sem exceção" ceiling in CLAUDE.md's régua de tamanho. The
 *      only two hard numeric ceilings in the project; added by R-3, after
 *      preload/index.ts was found already over its old 60-line ceiling with
 *      nothing here checking it.
 *
 *  11. BROKEN RELATIVE LINK in a .md — the only guard that inspects
 *      documentation, and the only one outside src/. Auto-conservação (a) of
 *      CLAUDE.md already tells a human to grep the old name before committing;
 *      it was written down and still failed 8 times, measured across the 92
 *      .md files in ago/2026 — six of them the same gesture, moving a plan
 *      from plan/active/ to plan/implemented/ and leaving ../active/ links
 *      behind. A link is binary (the file resolves or it does not), so this
 *      guard has no false positives, unlike the anchor and identifier checks
 *      that were considered and rejected for that reason.
 *
 * On violation: writes an explanation to stderr and exits 2, which feeds the
 * message back to Claude so it self-corrects. Otherwise exits 0. Any internal
 * error exits 0, so the hook never breaks the session.
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, editedFile, readHookInput, repoRelative, stripComments } from './_shared.mjs'

const INSPECTED_EXT = new Set(['.ts', '.tsx', '.mts', '.cts', '.css'])
const TOKENS_CSS = path.join(REPO_ROOT, 'src/renderer/src/shared/ui/tokens.css')
// The two hard, "sem exceção" numeric ceilings in CLAUDE.md's régua de
// tamanho — counted as total physical lines (comment and blank line
// included), matching wc -l.
const LINE_CEILINGS = {
  'src/main/index.ts': 100,
  'src/preload/index.ts': 100
}

const UNSAFE_WEBPREFS =
  /\b(?:sandbox\s*:\s*false|contextIsolation\s*:\s*false|nodeIntegration\s*:\s*true|webSecurity\s*:\s*false)\b/
const IPC_MAIN = /\bipcMain\s*\.\s*(?:handle|handleOnce|on|once)\s*\(/
const EXPOSE = /exposeInMainWorld\s*\(\s*['"]([^'"]+)['"]/g
const PROCESS_ENV = /\bprocess\s*\.\s*env\b/
// Vite's own idiom for exposing a build-time value to the renderer bundle —
// the same leak surface as `process.env`, just the Vite-native spelling.
const IMPORT_META_ENV = /\bimport\s*\.\s*meta\s*\.\s*env\b/
const ELECTRON_IMPORT =
  /^\s*(?:import\s[^\n]*from\s*['"]electron['"]|import\s*['"]electron['"]|(?:const|let|var)\s[^\n]*require\(\s*['"]electron['"])/m
const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/g
const VAR_USAGE = /var\(\s*(--[\w-]+)/g
// A custom property followed by a colon is a declaration. A usage is always
// `var(--x)` or `var(--x, fallback)` — never followed by one — so this does
// not need a line anchor, and must not have one: a compact tokens.css puts
// several declarations on the same line.
const VAR_DECL = /(--[\w-]+)\s*:/g
// Arbitrary utility value carrying a literal colour: bg-[#0d5bd9], text-[rgb(…)].
const ARBITRARY_COLOR =
  /[\w-]+-\[\s*(?:#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|oklch|oklab|lab|lch|color|color-mix)\()/g
// A primitive reached from a component, through either bracket form the v4
// grammar accepts: bg-(--gray-3) and text-[var(--blue-11-dark)].
const PRIMITIVE_UTILITY = /[\w-]+-[[(]\s*(?:var\(\s*)?(--(?:gray|blue|red|amber|green)-[\w-]+)/g
const STYLE_OBJECT = /style\s*=\s*\{\{([^}]*)\}\}/g
const LITERAL_COLOR = /#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|oklch|oklab)\(/
const CLASSNAME_VALUE = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\}|\{([^}]*)\})/g

/** Token names declared in tokens.css, or null when it does not exist yet. */
function declaredTokens() {
  if (!existsSync(TOKENS_CSS)) return null
  try {
    const css = stripComments(readFileSync(TOKENS_CSS, 'utf8'), { lineComments: false })
    return new Set([...css.matchAll(VAR_DECL)].map((m) => m[1]))
  } catch {
    return null
  }
}

// Paths whose links are deliberately NOT maintained: docs/README.md states
// that a link inside an archive is never repaired — the cost is real and the
// benefit none. Editing an archived file must not be blocked by rot that the
// project decided to accept.
const LINK_EXEMPT_SOURCE = [/^docs\/plan\/archive\//, /^docs\/HISTORY-archive\.md$/]
// `notes/` is gitignored (personal drafts): the target exists on this machine
// and never in the repository, so its absence proves nothing.
const LINK_EXEMPT_TARGET = /(^|\/)notes\//
// Inline and fenced code carry example paths, not links to resolve.
const FENCED = /```[\s\S]*?```|`[^`\n]*`/g
const MD_LINK = /\]\(\s*<?([^)\s>]+)>?/g

/**
 * Reports every relative link in a markdown file whose target does not exist.
 *
 * @param file - Absolute path of the edited markdown file.
 * @param rel - Its repo-relative POSIX path, used for the archive exemptions.
 */
function checkMarkdownLinks(file, rel) {
  if (LINK_EXEMPT_SOURCE.some((re) => re.test(rel))) return

  let raw
  try {
    raw = readFileSync(file, 'utf8')
  } catch {
    return
  }

  const prose = raw.replace(FENCED, '')
  const broken = []
  for (const [, target] of prose.matchAll(MD_LINK)) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) continue
    const [pathPart] = target.split('#')
    if (!pathPart || LINK_EXEMPT_TARGET.test(pathPart)) continue

    let decoded = pathPart
    try {
      decoded = decodeURIComponent(pathPart)
    } catch {
      /* keep the raw form when it is not valid percent-encoding */
    }
    if (!existsSync(path.resolve(path.dirname(file), decoded))) broken.push(target)
  }

  if (broken.length === 0) return
  const lista = [...new Set(broken)].slice(0, 6).join(', ')
  console.error(
    `[guard] Link relativo quebrado em ${path.basename(file)}:\n  - ${lista}\n` +
      '    O alvo não existe a partir da pasta deste arquivo. É a auto-conservação (a) do ' +
      'CLAUDE.md: ao mover ou renomear, o ponteiro vai junto. O caso mais comum é um plano ' +
      'que saiu de plan/active/ para plan/implemented/ — o link vira `./<plano>.md`. ' +
      'Se o alvo ainda não existe, crie-o antes de apontar para ele.'
  )
  process.exit(2)
}

const file = editedFile(await readHookInput())
if (!file) process.exit(0)

const relAny = repoRelative(file)

// 11. Markdown link integrity — runs before the src/-only gate below, and is
// the only guard that leaves src/. Documentation is the project's largest
// artefact and had no automated check at all until now.
if (relAny && path.extname(file).toLowerCase() === '.md') {
  checkMarkdownLinks(file, relAny)
  process.exit(0)
}

if (!INSPECTED_EXT.has(path.extname(file).toLowerCase())) process.exit(0)

const rel = relAny
if (!rel || !rel.startsWith('src/')) process.exit(0)

let raw
try {
  raw = readFileSync(file, 'utf8')
} catch {
  process.exit(0)
}

const isCss = file.endsWith('.css')
const isModuleCss = file.endsWith('.module.css')
// The Tailwind theme layer: not a module, but the file where a wrong token name
// costs the most — `@theme inline` maps one name to every utility built on it.
const isThemeCss = rel === 'src/renderer/src/assets/tailwind.css'
// The global reset (DS-6): not a module either, but it now carries var()
// references (color-scheme, ::selection, autofill) the same rule should cover.
const isBaseCss = rel === 'src/renderer/src/assets/base.css'
const isRendererTsx = rel.startsWith('src/renderer/') && file.endsWith('.tsx')
const isTest = /\.(test|spec)\./.test(path.basename(file))
const code = stripComments(raw, { lineComments: !isCss })
const violations = []

// 1. Security regression — the most expensive one to reintroduce silently.
if (rel.startsWith('src/main/')) {
  const match = code.match(UNSAFE_WEBPREFS)
  if (match) {
    violations.push(
      `REGRESSÃO DE SEGURANÇA: \`${match[0]}\` em webPreferences. A fronteira do ` +
        'renderer é `sandbox: true` + `contextIsolation: true` + `nodeIntegration: false`, ' +
        'decidida na fase 03 do plano de fundação. Se houver motivo real para relaxar, ' +
        'ele precisa ser registrado no CLAUDE.md antes — nunca alterado em silêncio.'
    )
  }
}

// 2. IPC registry bypass.
if (rel.startsWith('src/main/') && !rel.startsWith('src/main/ipc/') && !isTest) {
  if (IPC_MAIN.test(code)) {
    violations.push(
      '`ipcMain` usado fora de src/main/ipc/. Todo canal passa pelo registro tipado ' +
        '(`handle` de src/main/ipc/registry.ts), que valida o payload com zod e mantém o ' +
        'handler testável como função pura. Declare o canal em src/shared/ipc.ts e ' +
        'registre-o em register-all.ts.'
    )
  }
}

// 3. contextBridge surface.
for (const [, name] of code.matchAll(EXPOSE)) {
  if (name !== 'api') {
    violations.push(
      `\`exposeInMainWorld('${name}', ...)\`: o renderer recebe exatamente uma superfície, ` +
        '`api`, montada a partir do contrato. Expor uma segunda chave alarga a superfície ' +
        'que o contextIsolation existe para estreitar.'
    )
  }
}

// 4. Secret leak surface — process.env (no `process` under sandbox anyway)
// and import.meta.env (Vite statically inlines VITE_-prefixed values into
// the built bundle — the leak vector a Vite renderer actually has).
if (rel.startsWith('src/renderer/') && !isTest) {
  if (PROCESS_ENV.test(code)) {
    violations.push(
      '`process.env` no renderer. Sob sandbox não existe `process` ali, e é exatamente o ' +
        'lugar onde uma chave de API nunca pode aparecer. Segredo mora no main (safeStorage); ' +
        'o renderer pergunta se está configurado, nunca lê o valor.'
    )
  }
  if (IMPORT_META_ENV.test(code)) {
    violations.push(
      '`import.meta.env` no renderer. É o idioma nativo do Vite para expor variável de ' +
        'ambiente ao bundle — qualquer chave `VITE_*` acaba embutida no build. Segredo mora ' +
        'no main (safeStorage); o renderer pergunta se está configurado, nunca lê o valor.'
    )
  }
}

// 5. Layer purity.
if ((rel.startsWith('src/core/') || rel.startsWith('src/shared/')) && ELECTRON_IMPORT.test(code)) {
  violations.push(
    '`electron` importado de core/ ou shared/. Essas camadas são puras e reutilizáveis por ' +
      'main, workers e renderer. Acesso ao Electron fica em main/ ou preload/; a dependência ' +
      'entra por parâmetro (DIP).'
  )
}

// 6 and 7. Design-system rules over CSS the components own — the module files
// plus the Tailwind theme layer and the global reset, neither a module but
// both obeying the same rule.
if (isModuleCss || isThemeCss || isBaseCss) {
  const hexes = [...new Set([...code.matchAll(HEX_COLOR)].map((m) => m[0]))]
  if (hexes.length > 0) {
    violations.push(
      `Cor literal (${hexes.slice(0, 4).join(', ')}). Componente e camada de tema usam token ` +
        'semântico (`var(--color-*)`); primitivos e literais vivem só em shared/ui/tokens.css.'
    )
  }

  const known = declaredTokens()
  if (known && known.size > 0) {
    const unknown = [...new Set([...code.matchAll(VAR_USAGE)].map((m) => m[1]))].filter(
      (t) => !known.has(t)
    )
    if (unknown.length > 0) {
      violations.push(
        `Token inexistente: ${unknown.join(', ')}. Nenhum desses está declarado em ` +
          'shared/ui/tokens.css. `var()` com nome errado não gera erro — o navegador ' +
          'simplesmente não aplica nada, e o defeito só aparece quando alguém olhar ' +
          'para este componente específico.'
      )
    }
  }
}

// 8. The same design-system rule on the JSX side. What compilation already
// covers is not repeated here: the `--color-*: initial` of DS-1 makes
// `bg-slate-800` fail to build. This is what survives that.
if (isRendererTsx && !isTest) {
  const arbitrary = [...new Set([...code.matchAll(ARBITRARY_COLOR)].map((m) => m[0]))]
  if (arbitrary.length > 0) {
    violations.push(
      `Cor literal em valor arbitrário (${arbitrary.slice(0, 3).join(', ')}…). A paleta padrão ` +
        'já não compila, mas o valor arbitrário passa — e é o mesmo furo que a guarda 6 ' +
        'bloqueia no CSS. Use a utilidade do token: `bg-surface`, `text-accent-text`.'
    )
  }

  const primitives = [...new Set([...code.matchAll(PRIMITIVE_UTILITY)].map((m) => m[1]))]
  if (primitives.length > 0) {
    violations.push(
      `Token primitivo alcançado por utilidade: ${primitives.join(', ')}. Os dois níveis ` +
        'existem para que o tema claro possa remapear só o semântico — um componente preso ' +
        'ao primitivo não acompanha a troca de tema.'
    )
  }

  const styled = [...code.matchAll(STYLE_OBJECT)]
    .map((m) => m[1])
    .filter((body) => LITERAL_COLOR.test(body))
  if (styled.length > 0) {
    violations.push(
      'Cor literal em `style={{ }}`. Além de furar o sistema de tokens, estilo inline exige ' +
        "`style-src 'unsafe-inline'` na CSP — que o ROADMAP registra como dívida a fechar, e " +
        'foi o motivo de o `shiki` ser recusado na fase 12.'
    )
  }

  const inClassName = [...code.matchAll(CLASSNAME_VALUE)]
    .map((m) => m[1] ?? m[2] ?? m[3] ?? m[4] ?? '')
    .flatMap((value) => [...value.matchAll(HEX_COLOR)].map((m) => m[0]))
  if (inClassName.length > 0) {
    violations.push(
      `Cor literal dentro de \`className\` (${[...new Set(inClassName)].join(', ')}). ` +
        'Toda cor vem de token — nenhum `#hex` fora de shared/ui/tokens.css.'
    )
  }
}

// 9. Narrative `/* */` block in .ts/.tsx — the flooding symptom the `comments`
// skill bans. `/** */` doc-comments, directives and JSX `{/* */}` are allowed.
const isTsLike = /\.(?:ts|tsx|mts|cts)$/.test(file)
if (isTsLike && !isTest) {
  const BLOCK_DIRECTIVE =
    /^\/\*[\s!]*(?:eslint|global|prettier|ts-|@ts-|c8|istanbul|v8|@?__PURE__|webpack|@?vite)/
  const narrative = [...raw.matchAll(/\/\*(?!\*)[\s\S]*?\*\//g)].filter((m) => {
    if (BLOCK_DIRECTIVE.test(m[0])) return false
    // A JSX comment is `{/* … */}` — the brace wraps the comment on BOTH sides.
    // Checking only the left brace let an object literal with a comment as its
    // first token slip through (`const x = { /* narrative */ a: 1 }` also ends
    // with `{` before the comment, but has real content — not `}` — right after).
    const before = raw.slice(0, m.index).trimEnd()
    const after = raw.slice(m.index + m[0].length).trimStart()
    return !(before.endsWith('{') && after.startsWith('}'))
  })
  if (narrative.length > 0) {
    violations.push(
      'Bloco de comentário `/* */` em .ts/.tsx. A skill `comments` proíbe narrativa em ' +
        'bloco: use `//` para nota curta (até ~3 linhas, só o que o código não diz) ou ' +
        '`/** */` para docstring TSDoc; razão longa vai ao HISTORY.md, citada pela sigla. ' +
        'Comentário JSX `{/* */}` e diretivas continuam permitidos.'
    )
  }
}

// 10. Line ceiling for the two thin composition roots — the only two hard,
// "sem exceção" numbers in CLAUDE.md's régua de tamanho.
if (rel in LINE_CEILINGS) {
  const lineCount = (raw.match(/\n/g) ?? []).length
  const ceiling = LINE_CEILINGS[rel]
  if (lineCount > ceiling) {
    violations.push(
      `${rel} tem ${lineCount} linhas, acima do teto de ${ceiling} declarado no CLAUDE.md ` +
        '("sem exceção"). main/index.ts é só ciclo de vida e criação de janela; preload/index.ts ' +
        'é só tradução de chamada — lógica que cresceu aqui pertence a main/features/ ou core/.'
    )
  }
}

if (violations.length > 0) {
  console.error(
    `[guard] Violação de invariante do crivo em ${path.basename(file)}:\n` +
      violations.map((v) => `  - ${v}`).join('\n')
  )
  process.exit(2)
}

process.exit(0)
