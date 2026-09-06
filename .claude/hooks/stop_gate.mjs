#!/usr/bin/env node
/**
 * Claude Code Stop hook: run the gate that matches what actually changed.
 *
 * The Stop hook used to run `pnpm check:fast` unconditionally at the end of
 * every turn, which is ~150s of saturated CPU per answer. Two measurements
 * reshaped it:
 *
 *   - the suite is 87% of that gate (typecheck 14.7s + lint 3.8s + docs 0.3s
 *     against ~130s of tests), and it is the part `test_related` has already
 *     been running per edited file, over the import graph;
 *   - a turn that touched only markdown needs none of it.
 *
 * So the turn pays for typecheck + lint + docs, and the suite moved to
 * `commit_gate.mjs`, which runs it once per commit instead of once per answer.
 *
 * The decision comes from file mtimes against a stamp, not from `git status`:
 * committing mid-session clears the status without clearing the risk.
 *
 * Unsafe answers are never the default: a missing stamp, an unreadable tree,
 * or anything outside both path lists falls through to the full turn gate.
 *
 * Exit codes:
 *   0  gate passed, or nothing to verify
 *   2  gate failed — stderr is fed back to Claude
 */

import {
  CODE_PATHS,
  DOC_PATHS,
  newestMtime,
  readHookInput,
  readStamp,
  runGate,
  writeStamp
} from './_shared.mjs'

const STAMP = 'crivo-stop-stamp'
const MAX_OUTPUT_CHARS = 4000

const input = await readHookInput()
// The gate's own output can trigger another Stop; without this the hook loops.
if (input?.stop_hook_active) process.exit(0)

const stamp = readStamp(STAMP)
const startedAt = Date.now()

const codeAt = Math.max(...CODE_PATHS.map(newestMtime))
const docsAt = Math.max(...DOC_PATHS.map(newestMtime))

let script
if (stamp === 0 || codeAt > stamp) script = 'check:turn'
else if (docsAt > stamp) script = 'check:docs'
else process.exit(0)

const result = await runGate(`pnpm run ${script}`)

// A toolchain that cannot start must not wedge the session.
if (result.status === null) process.exit(0)

if (result.status !== 0) {
  const output = `${result.stdout}${result.stderr}`.trim()
  console.error(`[hook] pnpm run ${script} falhou:\n${output.slice(-MAX_OUTPUT_CHARS)}`)
  process.exit(2)
}

writeStamp(STAMP, startedAt)
process.exit(0)
