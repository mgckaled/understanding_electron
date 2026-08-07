#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook: run the tests related to the edited file.
 *
 * `vitest related` walks the module graph and executes only the test files
 * that (transitively) import the given file, which keeps the loop in the
 * sub-second-to-a-few-seconds range instead of running the whole suite.
 *
 * Exit codes:
 *   0  passed, no related tests, or the toolchain is unavailable
 *   2  failed — the captured output goes to stderr and is fed back to Claude
 *
 * Design notes:
 *   - `--passWithNoTests` is required. A file with no related test is the
 *     normal case early in a project and must not read as a failure.
 *   - Timing out exits 0 on purpose: a slow hook must never wedge the session.
 *   - The Playwright suites are deliberately out of reach. They cost minutes
 *     and live behind their own scripts — see D8.2 in
 *     docs/plan/*\/08-automacao-e-registro.md.
 */

import path from 'node:path'
import { editedFile, readHookInput, repoRelative, runBin } from './_shared.mjs'

const WATCHED_EXT = new Set(['.ts', '.tsx'])
const TIMEOUT_MS = 90_000
const MAX_OUTPUT_CHARS = 4000

const file = editedFile(await readHookInput())
if (!file) process.exit(0)
if (!WATCHED_EXT.has(path.extname(file).toLowerCase())) process.exit(0)

const rel = repoRelative(file)
// config, scripts and e2e are not covered by the unit projects
if (!rel || !rel.startsWith('src/')) process.exit(0)

const result = runBin(
  'vitest',
  // `dot`, not `basic`: the `basic` reporter was removed in Vitest 4 (this
  // project is on 4.1.10), where it fails to load and aborts vitest before any
  // test runs — which made this hook block *every* edit. `dot` is the minimal
  // built-in survivor: one dot per test, full detail only on failure.
  ['related', '--run', '--passWithNoTests', '--reporter', 'dot', rel],
  { timeout: TIMEOUT_MS }
)

// null = vitest not installed; null status = killed by the timeout
if (!result || result.status === null || result.status === 0) process.exit(0)

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().slice(-MAX_OUTPUT_CHARS)
console.error(`[test] Testes relacionados a ${rel} falharam:\n${output}`)
process.exit(2)
