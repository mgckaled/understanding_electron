import { Language, StreamLanguage, type StreamParser } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { classHighlighter, highlightCode } from '@lezer/highlight'
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

// Built once per id: the editor wants an Extension and the preview wants a
// parser, and both come from the same Language — which is what keeps the two
// renderings on the same grammar, not just the same colours (DE2B.1).
const CACHE = new Map<string, Language>()

function languageFor(id: string | null | undefined): Language | null {
  if (id === null || id === undefined) return null
  const cached = CACHE.get(id)
  if (cached !== undefined) return cached
  // Markdown already ships in this bundle for the prose editor; reusing it
  // costs nothing and keeps a ```markdown fence from falling to plain text.
  const mode = MODES[id]
  const language =
    id === 'markdown'
      ? markdown().language
      : mode === undefined
        ? null
        : StreamLanguage.define(mode)
  if (language === null) return null
  CACHE.set(id, language)
  return language
}

/**
 * The editor extension for a language id, or `null` when there is none.
 *
 * @param id - A canonical id from `resolveLanguage`, or `null`/`undefined` when
 *   the fence named no language or named one we do not know. Both mean plain
 *   text, never a guess (DE2B.4).
 */
export function grammarFor(id: string | null | undefined): Extension | null {
  return languageFor(id)?.extension ?? null
}

/** A run of code carrying the classes the highlighter gave it. */
export type CodeToken = { text: string; classes: string }

/**
 * Splits `code` into classified tokens, one array per line.
 *
 * The same `classHighlighter` the editor is configured with, so both renderings
 * emit the same `.tok-*` classes and read from the one block of CSS (DE2B.1).
 * Lezer types stay inside this module: `@lezer/common` is not a declared
 * dependency, and naming its types here would be a phantom import.
 *
 * @param code - The draft's text, verbatim.
 * @param id - A canonical language id, or `null` for none.
 * @returns Lines of tokens, or `null` when no grammar applies — the caller then
 *   renders the text plain, which is the honest state (DE2B.4).
 */
export function tokenize(code: string, id: string | null | undefined): CodeToken[][] | null {
  const language = languageFor(id)
  if (language === null) return null

  const lines: CodeToken[][] = [[]]
  highlightCode(
    code,
    language.parser.parse(code),
    classHighlighter,
    (text, classes) => lines[lines.length - 1].push({ text, classes }),
    () => lines.push([])
  )
  return lines
}

/** Every id with a grammar, so a test can hold the two tables to each other. */
export const HIGHLIGHTED_IDS: readonly string[] = [...Object.keys(MODES), 'markdown']
