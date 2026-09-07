// Shapes as the v2 API really answers, captured 07/09/2026 — not as the
// published openapi.json describes it: `generationDate` and
// `searchFilterApplied` arrive without being in the schema (23-A probe).

/** One entry of `GET /api/v2/libs/search`, before normalization. */
export type SearchResultWire = {
  id: string
  title: string
  description: string
  branch: string
  lastUpdateDate: string
  // Free string, not an enum: only 'finalized' was ever observed, and finding
  // a library in another state is still open (moved to 23-I).
  state: string
  totalTokens: number
  totalSnippets: number
  stars: number
  trustScore: number
  benchmarkScore: number
  versions: string[]
}

export type SearchResponseWire = {
  results: SearchResultWire[]
  searchFilterApplied?: boolean
}

export type CodeSnippetWire = {
  codeTitle: string
  codeDescription: string
  codeLanguage: string
  codeTokens: number
  codeId: string
  pageTitle: string
  codeList: { language: string; code: string }[]
  generationDate?: string
  sourceFile?: string
}

export type InfoSnippetWire = {
  pageId: string
  breadcrumb?: string
  content: string
  contentTokens: number
}

export type RulesWire = {
  global?: string[]
  libraryOwn?: string[]
  libraryTeam?: string[]
}

export type ContextResponseWire = {
  codeSnippets: CodeSnippetWire[]
  infoSnippets: InfoSnippetWire[]
  rules?: RulesWire
}

/** Both `400 validation_error` and `404 no_libraries_found` answer with this. */
export type ErrorBodyWire = { error?: string; message?: string }

/** A library the user can pick, after the app's own ordering (D23A.4). */
export type LibraryCandidate = {
  // Synthetic: `id` repeats inside a single response (D23A.5).
  key: string
  id: string
  title: string
  description: string
  branch: string
  state: string
  lastUpdateDate: string
  totalTokens: number
  totalSnippets: number
  /** `null` where the wire says `-1`, which means "does not apply" (D23A.6). */
  stars: number | null
  trustScore: number
  benchmarkScore: number
  /** `__branch__*` dropped, raw order kept — "latest" is not computable (D23A.6). */
  versions: string[]
}

export type DocSnippet = {
  key: string
  title: string
  description: string
  language: string
  tokens: number
  code: string
  pageTitle: string | null
  sourceUrl: string | null
}

export type DocNote = {
  key: string
  breadcrumb: string | null
  content: string
  tokens: number
  sourceUrl: string | null
}

export type DocRules = {
  global: string[]
  libraryOwn: string[]
  libraryTeam: string[]
}

export type DocsResult = {
  snippets: DocSnippet[]
  notes: DocNote[]
  // Never merged into the two lists above: shown, never sent (DM-17, D23A.8).
  rules: DocRules | null
}

/**
 * What the search resolved to. A miss is a screen state, not an error — the
 * caller draws it, nothing maps to AppError (D23A.3).
 */
export type SearchOutcome =
  { status: 'found'; candidates: LibraryCandidate[] } | { status: 'no-libraries'; message: string }

export type ContextOutcome =
  | { status: 'ready'; docs: DocsResult }
  | { status: 'empty' }
  | { status: 'indexing'; state: string | null }

/** The narrow slice of `Response` this client reads; the global fetch satisfies it. */
export type HttpResponse = {
  readonly status: number
  readonly headers: { get(name: string): string | null }
  text(): Promise<string>
}

/**
 * The single network-touching seam, injected by the caller — same shape of
 * decision as `ChatFn` (D9.2) and the reason a level-1 test runs offline
 * against recorded fixtures (D23A.1).
 */
export type Context7Fetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal }
) => Promise<HttpResponse>
