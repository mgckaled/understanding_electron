#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook: enforce data-lab hard invariants.
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
 *   4. SECRET LEAK — `process.env` inside src/renderer/. There is no
 *      `process` there under sandbox, and it is the one place an API key must
 *      never appear. Relevant ahead of the AI layer (Ollama/Gemini/GLM).
 *
 *   5. LAYER PURITY — `electron` imported from src/core/ or src/shared/.
 *      Redundant with ESLint by design: this fires on every edit, whereas
 *      lint only runs when invoked.
 *
 *   6. HARDCODED DESIGN VALUE — hex colour in a *.module.css. ESLint does not
 *      lint CSS, so the token rule has no automated enforcement otherwise.
 *
 *   7. UNKNOWN TOKEN — `var(--x)` in a *.module.css with no matching
 *      declaration in tokens.css. Catches the typo that renders as "no style
 *      at all" and is invisible until someone looks at that exact component.
 *      Inert until the design system lands in phase 05.
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

const UNSAFE_WEBPREFS =
  /\b(?:sandbox\s*:\s*false|contextIsolation\s*:\s*false|nodeIntegration\s*:\s*true|webSecurity\s*:\s*false)\b/
const IPC_MAIN = /\bipcMain\s*\.\s*(?:handle|handleOnce|on|once)\s*\(/
const EXPOSE = /exposeInMainWorld\s*\(\s*['"]([^'"]+)['"]/g
const PROCESS_ENV = /\bprocess\s*\.\s*env\b/
const ELECTRON_IMPORT =
  /^\s*(?:import\s[^\n]*from\s*['"]electron['"]|import\s*['"]electron['"]|(?:const|let|var)\s[^\n]*require\(\s*['"]electron['"])/m
const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/g
const VAR_USAGE = /var\(\s*(--[\w-]+)/g
// A custom property followed by a colon is a declaration. A usage is always
// `var(--x)` or `var(--x, fallback)` — never followed by one — so this does
// not need a line anchor, and must not have one: a compact tokens.css puts
// several declarations on the same line.
const VAR_DECL = /(--[\w-]+)\s*:/g

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

const file = editedFile(await readHookInput())
if (!file) process.exit(0)
if (!INSPECTED_EXT.has(path.extname(file).toLowerCase())) process.exit(0)

const rel = repoRelative(file)
if (!rel || !rel.startsWith('src/')) process.exit(0)

let raw
try {
  raw = readFileSync(file, 'utf8')
} catch {
  process.exit(0)
}

const isCss = file.endsWith('.css')
const isModuleCss = file.endsWith('.module.css')
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

// 4. Secret leak surface.
if (rel.startsWith('src/renderer/') && !isTest && PROCESS_ENV.test(code)) {
  violations.push(
    '`process.env` no renderer. Sob sandbox não existe `process` ali, e é exatamente o ' +
      'lugar onde uma chave de API nunca pode aparecer. Segredo mora no main (safeStorage); ' +
      'o renderer pergunta se está configurado, nunca lê o valor.'
  )
}

// 5. Layer purity.
if ((rel.startsWith('src/core/') || rel.startsWith('src/shared/')) && ELECTRON_IMPORT.test(code)) {
  violations.push(
    '`electron` importado de core/ ou shared/. Essas camadas são puras e reutilizáveis por ' +
      'main, workers e renderer. Acesso ao Electron fica em main/ ou preload/; a dependência ' +
      'entra por parâmetro (DIP).'
  )
}

// 6 and 7. Design-system rules, module CSS only.
if (isModuleCss) {
  const hexes = [...new Set([...code.matchAll(HEX_COLOR)].map((m) => m[0]))]
  if (hexes.length > 0) {
    violations.push(
      `Cor literal em módulo CSS (${hexes.slice(0, 4).join(', ')}). Componente usa token ` +
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

if (violations.length > 0) {
  console.error(
    `[guard] Violação de invariante do data-lab em ${path.basename(file)}:\n` +
      violations.map((v) => `  - ${v}`).join('\n')
  )
  process.exit(2)
}

process.exit(0)
