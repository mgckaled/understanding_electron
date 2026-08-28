import { StreamLanguage, type StreamParser } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import type { Extension } from '@codemirror/state'
import { python } from '@codemirror/legacy-modes/mode/python'
import { javascript, json, typescript } from '@codemirror/legacy-modes/mode/javascript'
import { standardSQL } from '@codemirror/legacy-modes/mode/sql'
import { c, cpp, csharp, java, kotlin, scala } from '@codemirror/legacy-modes/mode/clike'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { powerShell } from '@codemirror/legacy-modes/mode/powershell'
import { go } from '@codemirror/legacy-modes/mode/go'
import { rust } from '@codemirror/legacy-modes/mode/rust'
import { ruby } from '@codemirror/legacy-modes/mode/ruby'
import { r } from '@codemirror/legacy-modes/mode/r'
import { lua } from '@codemirror/legacy-modes/mode/lua'
import { yaml } from '@codemirror/legacy-modes/mode/yaml'
import { toml } from '@codemirror/legacy-modes/mode/toml'
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile'
import { css } from '@codemirror/legacy-modes/mode/css'
import { html, xml } from '@codemirror/legacy-modes/mode/xml'
import { diff } from '@codemirror/legacy-modes/mode/diff'

// Stream modes, not the official lang-* packages (DE2B.2): there is no
// `lang-any`, and 14 mode files cover ~25 languages for +117.854 B — half of
// what lang-markdown alone already costs. Keyed by the canonical id that
// core/draft/languages.ts resolves to; the export names are NOT the file names
// (`powerShell`, `dockerFile`), and `sql` is a factory, so the modes here are
// the exact symbols each file publishes.
const MODES: Record<string, StreamParser<unknown>> = {
  python,
  javascript,
  typescript,
  tsx: typescript,
  jsx: javascript,
  json,
  sql: standardSQL,
  bash: shell,
  powershell: powerShell,
  c,
  cpp,
  csharp,
  java,
  kotlin,
  scala,
  go,
  rust,
  ruby,
  r,
  lua,
  yaml,
  toml,
  dockerfile: dockerFile,
  css,
  html,
  xml,
  diff
}

/**
 * The grammar for a language id, or `null` when there is none to apply.
 *
 * @param id - A canonical id from `resolveLanguage`, or `null`/`undefined` when
 *   the fence named no language or named one we do not know. Both mean plain
 *   text, never a guess (DE2B.4).
 */
export function grammarFor(id: string | null | undefined): Extension | null {
  if (id === null || id === undefined) return null
  // Markdown already ships in this bundle for the prose editor; reusing it
  // costs nothing and keeps a ```markdown fence from falling to plain text.
  if (id === 'markdown') return markdown()
  const mode = MODES[id]
  return mode === undefined ? null : StreamLanguage.define(mode)
}

/** Every id with a grammar, so a test can hold the two tables to each other. */
export const HIGHLIGHTED_IDS: readonly string[] = [...Object.keys(MODES), 'markdown']
