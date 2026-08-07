#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook: auto-format/lint the edited file.
 *
 * Runs Prettier (every supported extension) and `eslint --fix` (TS/JS only)
 * on the single file that was just edited. Non-blocking by design: always
 * exits 0, so a formatter hiccup never interrupts the session.
 *
 * Formatting on every edit is safe in a way that a full check is not — it is
 * idempotent and cannot fail because of a half-finished refactor. That is why
 * this hook fires per edit while `check:fast` fires per response. See
 * docs/plan/*\/08-automacao-e-registro.md, decision D8.1.
 */

import path from 'node:path'
import { editedFile, readHookInput, repoRelative, runBin } from './_shared.mjs'

const PRETTIER_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.json',
  '.jsonc',
  '.md',
  '.yml',
  '.yaml',
  '.html'
])
const ESLINT_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

const file = editedFile(await readHookInput())
if (!file) process.exit(0)

const ext = path.extname(file).toLowerCase()
if (!PRETTIER_EXT.has(ext)) process.exit(0)

const rel = repoRelative(file)
if (!rel) process.exit(0) // only touch files inside the repository

runBin('prettier', ['--write', '--log-level', 'warn', rel])
if (ESLINT_EXT.has(ext)) runBin('eslint', ['--fix', '--quiet', rel])

process.exit(0)
