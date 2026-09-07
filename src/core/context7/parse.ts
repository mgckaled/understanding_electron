import type { DocNote, DocRules, DocSnippet, DocsResult, LibraryCandidate } from '@shared/ipc'
import type { ContextResponseWire, SearchResponseWire, SearchResultWire } from './types'

// The wire says -1 for "does not apply", on every website-backed entry.
const STARS_NOT_APPLICABLE = -1

// The API answers this literal where a page has no title of its own.
const PAGE_TITLE_SENTINEL = 'Unknown'

const BRANCH_VERSION_PREFIX = '__branch__'

/**
 * Turns a raw search body into the list the panel draws, ordered by the app.
 *
 * @returns Candidates in a total order, so the same search always draws the
 *   same screen — the API's own order changes between identical calls (D23A.4).
 */
export function normalizeCandidates(wire: SearchResponseWire): LibraryCandidate[] {
  const results = wire.results ?? []
  return results
    .map((result, index) => ({ candidate: toCandidate(result), index }))
    .sort(compareCandidates)
    .map(({ candidate }) => candidate)
}

function toCandidate(result: SearchResultWire): LibraryCandidate {
  return {
    key: `${result.id}#${result.benchmarkScore}#${result.totalSnippets}`,
    id: result.id,
    title: result.title,
    description: result.description,
    branch: result.branch,
    state: result.state,
    lastUpdateDate: result.lastUpdateDate,
    totalTokens: result.totalTokens,
    totalSnippets: result.totalSnippets,
    stars: result.stars === STARS_NOT_APPLICABLE ? null : result.stars,
    trustScore: result.trustScore,
    benchmarkScore: result.benchmarkScore,
    versions: (result.versions ?? []).filter((v) => !v.startsWith(BRANCH_VERSION_PREFIX))
  }
}

// Four keys, not two: `id` repeats within one response, so the pair
// (benchmarkScore, id) can still tie (D23A.4).
function compareCandidates(
  a: { candidate: LibraryCandidate; index: number },
  b: { candidate: LibraryCandidate; index: number }
): number {
  return (
    b.candidate.benchmarkScore - a.candidate.benchmarkScore ||
    a.candidate.id.localeCompare(b.candidate.id) ||
    b.candidate.totalSnippets - a.candidate.totalSnippets ||
    a.index - b.index
  )
}

/**
 * Turns a raw context body into what the three tabs render.
 *
 * @returns Snippets and notes in the order the service ranked them, with
 *   `rules` in its own field — never folded into either list (D23A.8).
 */
export function normalizeDocs(wire: ContextResponseWire): DocsResult {
  return {
    snippets: (wire.codeSnippets ?? []).map(toSnippet),
    notes: (wire.infoSnippets ?? []).map(toNote),
    rules: toRules(wire)
  }
}

function toSnippet(
  snippet: ContextResponseWire['codeSnippets'][number],
  index: number
): DocSnippet {
  const pageTitle = snippet.pageTitle
  return {
    // `codeId` addresses the source page and repeats across snippets — five
    // snippets shared one in the zod fixture — so it cannot be the key alone.
    key: `${snippet.codeId}#${index}`,
    title: snippet.codeTitle,
    description: snippet.codeDescription,
    tokens: snippet.codeTokens,
    blocks: (snippet.codeList ?? []).map((block) => ({
      language: block.language === '' ? snippet.codeLanguage : block.language,
      code: block.code
    })),
    pageTitle: pageTitle === PAGE_TITLE_SENTINEL || pageTitle === '' ? null : pageTitle,
    sourceUrl: sourceUrlOf(snippet.codeId)
  }
}

function toNote(note: ContextResponseWire['infoSnippets'][number], index: number): DocNote {
  return {
    key: `${note.pageId}#${index}`,
    breadcrumb: note.breadcrumb === undefined || note.breadcrumb === '' ? null : note.breadcrumb,
    content: note.content,
    tokens: note.contentTokens,
    sourceUrl: sourceUrlOf(note.pageId)
  }
}

function toRules(wire: ContextResponseWire): DocRules | null {
  const rules: DocRules = {
    global: wire.rules?.global ?? [],
    libraryOwn: wire.rules?.libraryOwn ?? [],
    libraryTeam: wire.rules?.libraryTeam ?? []
  }
  const total = rules.global.length + rules.libraryOwn.length + rules.libraryTeam.length
  return total === 0 ? null : rules
}

/**
 * Reads provenance out of a field that has two real formats: a full URL, and
 * a repository-relative id with an anchor. Trying and failing is the only safe
 * treatment — assuming either one breaks on the other (D23A.7).
 *
 * @returns The absolute http(s) URL, or `null` when the field is not one.
 */
export function sourceUrlOf(raw: string): string | null {
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
