#!/usr/bin/env node
/**
 * Claude Code Stop hook: run the gate that matches what actually changed.
 *
 * The Stop hook used to run `pnpm check:fast` unconditionally at the end of
 * every turn — three typecheck projects, lint and the whole suite — even for
 * turns that touched nothing but markdown. On this machine that is ~2 min of
 * saturated CPU per turn, and it collides with the same command run by hand
 * moments earlier: two full gates over the identical state.
 *
 * The decision is made from file mtimes against a stamp, not from `git
 * status`: committing mid-session clears the status without clearing the risk.
 *
 *   code touched  -> `check:fast`   (~2 min)
 *   only docs     -> `check:docs`   (~0.3 s)
 *   nothing       -> nothing
 *
 * Unsafe answers are never the default: a missing stamp, an unreadable tree,
 * or anything outside both lists falls through to `check:fast`.
 *
 * Exit codes:
 *   0  gate passed, or nothing to verify
 *   2  gate failed — stderr is fed back to Claude
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { REPO_ROOT, readHookInput } from './_shared.mjs'

const STAMP = path.join(REPO_ROOT, 'node_modules', '.cache', 'crivo-stop-stamp')
const MAX_OUTPUT_CHARS = 4000
const TIMEOUT_MS = 600_000

/** Anything here invalidates the full gate. */
const CODE = [
  'src',
  'test',
  'e2e',
  'config',
  'scripts',
  '.claude/hooks',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'vitest.config.ts',
  'electron.vite.config.ts',
  'eslint.config.mjs',
  'tsconfig.json',
  'tsconfig.node.json',
  'tsconfig.web.json',
  'tsconfig.e2e.json'
]

/** Anything here only needs the link/section check. */
const DOCS = ['docs', '.claude/skills', 'CLAUDE.md', 'README.md']

const SKIP_DIRS = new Set(['node_modules', 'out', 'dist', '.git', 'coverage'])

/**
 * Returns the newest mtime under a path, or 0 when it does not exist.
 *
 * @param rel - Repo-relative file or directory.
 * @returns Epoch milliseconds of the most recently modified entry.
 */
function newestMtime(rel) {
  const abs = path.join(REPO_ROOT, rel)
  let newest = 0
  const visit = (target) => {
    let stat
    try {
      stat = fs.statSync(target)
    } catch {
      return
    }
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(path.basename(target))) return
      let entries
      try {
        entries = fs.readdirSync(target)
      } catch {
        return
      }
      for (const entry of entries) visit(path.join(target, entry))
      return
    }
    if (stat.mtimeMs > newest) newest = stat.mtimeMs
  }
  visit(abs)
  return newest
}

/** Reads the stamp, or 0 when it is absent or unreadable — which forces the full gate. */
function readStamp() {
  try {
    return Number(fs.readFileSync(STAMP, 'utf8')) || 0
  } catch {
    return 0
  }
}

const input = await readHookInput()
// The gate's own output can trigger another Stop; without this the hook loops.
if (input?.stop_hook_active) process.exit(0)

const stamp = readStamp()
const startedAt = Date.now()

const codeAt = Math.max(...CODE.map(newestMtime))
const docsAt = Math.max(...DOCS.map(newestMtime))

let script
if (stamp === 0 || codeAt > stamp) script = 'check:fast'
else if (docsAt > stamp) script = 'check:docs'
else process.exit(0)

const result = spawnSync('pnpm', ['run', script], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
  shell: true,
  timeout: TIMEOUT_MS,
  windowsHide: true
})

// A toolchain that cannot start must not wedge the session.
if (result.error || result.status === null) process.exit(0)

if (result.status !== 0) {
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  console.error(`[hook] pnpm run ${script} falhou:\n${output.slice(-MAX_OUTPUT_CHARS)}`)
  process.exit(2)
}

// Stamped with the time the scan started, never the time it finished: a file
// written *during* the run would otherwise be treated as already verified.
try {
  fs.mkdirSync(path.dirname(STAMP), { recursive: true })
  fs.writeFileSync(STAMP, String(startedAt))
} catch {
  // A stamp that cannot be written just means the next turn runs the full gate.
}
process.exit(0)
