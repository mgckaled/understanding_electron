#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook: the full suite runs before a commit, not after
 * every answer.
 *
 * The project's rule has always been "check:fast green before each commit".
 * The Stop hook enforced it by running the suite every turn — same guarantee,
 * paid dozens of times instead of once. Here it is paid at the moment the rule
 * actually names, and skipped entirely when no code changed since the last
 * green run (a run of documentation commits then costs nothing).
 *
 * Blocking here is the right shape: exit 2 stops the commit from happening at
 * all, rather than reporting a failure after it landed.
 *
 * Exit codes:
 *   0  suite passed, nothing changed since the last green run, or not a commit
 *   2  suite failed — the commit is blocked and stderr is fed back to Claude
 */

import {
  CODE_PATHS,
  newestMtime,
  readHookInput,
  readStamp,
  runGate,
  toolCommand,
  writeStamp
} from './_shared.mjs'

const STAMP = 'crivo-suite-stamp'
const MAX_OUTPUT_CHARS = 4000

/**
 * True when the command actually creates a commit.
 *
 * `--help`/`-h` and `--dry-run` are excluded because they change nothing, and
 * a bare mention inside a quoted message must not trigger the suite — hence
 * the anchor on a command boundary rather than a substring search.
 *
 * @param command - The shell command the tool is about to run.
 */
function isCommit(command) {
  // Tokens before `commit` may be flags or `-c key=value` pairs; anything else
  // (`git log --grep commit`) must not match.
  if (!/(^|[;&|])\s*git\s+(?:-{1,2}\S+\s+|\S+=\S+\s+)*commit\b/.test(command)) return false
  return !/\B--(help|dry-run)\b|\s-h\b/.test(command)
}

const command = toolCommand(await readHookInput())
if (!command || !isCommit(command)) process.exit(0)

const stamp = readStamp(STAMP)
const startedAt = Date.now()
const codeAt = Math.max(...CODE_PATHS.map(newestMtime))

// Nothing to re-prove: the last green run already covered this tree.
if (stamp !== 0 && codeAt <= stamp) process.exit(0)

const result = await runGate('pnpm run check:fast')

// A toolchain that cannot start must not block the commit.
if (result.status === null) process.exit(0)

if (result.status !== 0) {
  const output = `${result.stdout}${result.stderr}`.trim()
  console.error(
    `[hook] commit bloqueado — \`pnpm check:fast\` falhou:\n${output.slice(-MAX_OUTPUT_CHARS)}`
  )
  process.exit(2)
}

writeStamp(STAMP, startedAt)
process.exit(0)
