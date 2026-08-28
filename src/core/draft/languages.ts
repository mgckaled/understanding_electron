/**
 * What a fenced block's info string resolves to (DE2B.3).
 *
 * The info string is written by the model, not by a schema, so the same
 * language arrives as `py`, `python` or `python3`. Alias and file name resolve
 * in one step: two chained tables would be two things to age.
 */
export type CodeLanguage = {
  /** Canonical id — the key the editor reads its grammar table by. */
  id: string
  /** Suffix of the exported file, WITHOUT the dot — `exportFileName` adds it. */
  extension: string
  /**
   * Whole file name, for a language identified by name rather than by suffix.
   * The Linguist models this as `filenames`, separate from `extensions`.
   */
  wholeName?: string
}

type Entry = CodeLanguage & { aliases?: readonly string[] }

// Derived from github-linguist/languages.yml, written by hand rather than
// depended on: 700 languages to use ~25 does not pass the dependency rule.
// The `aliases` are what a model actually writes on a fence, not every alias
// the Linguist knows.
const LANGUAGES: readonly Entry[] = [
  { id: 'python', extension: 'py', aliases: ['py', 'python3'] },
  { id: 'javascript', extension: 'js', aliases: ['js', 'node', 'mjs', 'cjs'] },
  { id: 'typescript', extension: 'ts', aliases: ['ts'] },
  { id: 'tsx', extension: 'tsx' },
  { id: 'jsx', extension: 'jsx' },
  { id: 'json', extension: 'json' },
  { id: 'sql', extension: 'sql', aliases: ['postgres', 'postgresql', 'mysql', 'sqlite'] },
  { id: 'bash', extension: 'sh', aliases: ['sh', 'shell', 'zsh', 'shellscript'] },
  { id: 'powershell', extension: 'ps1', aliases: ['ps1', 'pwsh'] },
  { id: 'c', extension: 'c' },
  { id: 'cpp', extension: 'cpp', aliases: ['c++', 'cc', 'cxx'] },
  { id: 'csharp', extension: 'cs', aliases: ['cs', 'c#'] },
  { id: 'java', extension: 'java' },
  { id: 'kotlin', extension: 'kt', aliases: ['kt'] },
  { id: 'scala', extension: 'scala' },
  { id: 'go', extension: 'go', aliases: ['golang'] },
  { id: 'rust', extension: 'rs', aliases: ['rs'] },
  { id: 'ruby', extension: 'rb', aliases: ['rb'] },
  { id: 'r', extension: 'R' },
  { id: 'lua', extension: 'lua' },
  { id: 'yaml', extension: 'yaml', aliases: ['yml'] },
  { id: 'toml', extension: 'toml' },
  { id: 'dockerfile', extension: 'dockerfile', wholeName: 'Dockerfile', aliases: ['docker'] },
  { id: 'css', extension: 'css' },
  { id: 'html', extension: 'html' },
  { id: 'xml', extension: 'xml' },
  { id: 'diff', extension: 'diff', aliases: ['patch'] },
  { id: 'markdown', extension: 'md', aliases: ['md'] }
]

const BY_ALIAS = new Map<string, CodeLanguage>(
  LANGUAGES.flatMap(({ aliases, ...language }) =>
    [language.id, ...(aliases ?? [])].map((alias) => [alias, language] as const)
  )
)

/** What an unknown or absent fence exports as — never a guess (DE2B.4). */
export const FALLBACK_EXTENSION = 'txt'

/**
 * Resolves a fence's info string to a known language.
 *
 * @param fence - The info string as written, or `null` when the fence named
 *   none — a normal fence, not a defect (D11.5).
 * @returns The language, or `null` when it is absent or unknown.
 */
export function resolveLanguage(fence: string | null): CodeLanguage | null {
  if (fence === null) return null
  return BY_ALIAS.get(fence.trim().toLowerCase()) ?? null
}
