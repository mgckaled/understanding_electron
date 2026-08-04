#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook: blocks AI co-authorship on commits.
 *
 * Inspects Bash/PowerShell commands before they run. If the command carries
 * a `Co-authored-by` trailer mentioning Claude or Anthropic, the commit is
 * blocked before it happens — fixing it after the fact means `--amend`, and
 * an amend on a commit already pushed is worse than the hook.
 *
 * Authorship belongs to whoever reviews and decides, not whoever drafted the
 * text. See CLAUDE.md § Commits.
 *
 * The pattern matches "claude" or "anthropic" on their own, not the full
 * trailer text — that covers every model name (Sonnet, Opus, Haiku, Fable),
 * since each one either contains "claude" or lands on an "anthropic" e-mail
 * domain in the default trailer.
 *
 * On violation: writes an explanation to stderr and exits 2, which feeds the
 * message back to Claude so it self-corrects. Otherwise exits 0. Any internal
 * error exits 0, so the hook never breaks the session.
 */

import { readHookInput, toolCommand } from './_shared.mjs'

const COAUTHOR_AI = /co-authored-by:.*\b(claude|anthropic)\b/i

const command = toolCommand(await readHookInput())
if (!command) process.exit(0)

if (COAUTHOR_AI.test(command)) {
  console.error(
    '[no_ai_coauthor] Commit com `Co-authored-by` mencionando IA. Remova essa linha da ' +
      'mensagem — autoria é de quem revisa e decide, não de quem redige o texto. ' +
      'Ver CLAUDE.md § Commits.'
  )
  process.exit(2)
}

process.exit(0)
