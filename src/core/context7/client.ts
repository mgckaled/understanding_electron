import { UpstreamError } from '@core/ai/types'
import { describeUpstreamError } from '@core/ai/upstreamError'
import { normalizeCandidates, normalizeDocs } from './parse'
import type { ContextOutcome, SearchOutcome } from '@shared/ipc'
import type {
  Context7Fetch,
  ContextResponseWire,
  ErrorBodyWire,
  HttpResponse,
  SearchResponseWire
} from './types'

// DM-20 keeps a service URL in the provider adapter, never in core/ — but that
// rule describes adapters, and DM-26 put this client in core/, where there is
// none. Named exception, overridable so a probe never edits code (D23A.2).
const CONTEXT7_BASE_URL = 'https://context7.com/api/v2'

// `fast=false` keeps their LLM reranking (DM-18), which costs seconds.
const CONTEXT7_TIMEOUT_MS = 30_000

export type Context7Deps = {
  fetchFn: Context7Fetch
  apiKey?: string | null
  baseUrl?: string
  signal?: AbortSignal
}

/**
 * Searches for a library by name, so the user can disambiguate before the
 * second call is spent.
 *
 * @param query - The user's words, sent as written — it is what ranks the
 *   result, and rewriting it would degrade what the service does well (DM-22).
 * @returns Candidates in the app's own order, or the miss as a screen state.
 */
export async function searchLibraries(query: string, deps: Context7Deps): Promise<SearchOutcome> {
  const response = await request('/libs/search', { query }, deps)
  const body = await response.text()

  if (response.status === 404) {
    return { status: 'no-libraries', message: parseError(body).message ?? '' }
  }
  failOnBadStatus(response, body, deps)

  const wire = parseJson<SearchResponseWire>(body, response.status)
  const candidates = normalizeCandidates(wire)
  return candidates.length === 0
    ? { status: 'no-libraries', message: '' }
    : { status: 'found', candidates }
}

/**
 * Fetches documentation for one library.
 *
 * @param version - A version the library indexes; absent means the library's
 *   default, because "most recent" is not computable from `versions[]` (D23A.6).
 * @returns The three lists, or the outcome the panel draws instead of them.
 */
export async function fetchLibraryContext(
  args: { libraryId: string; query: string; version?: string },
  deps: Context7Deps
): Promise<ContextOutcome> {
  const libraryId =
    args.version === undefined ? args.libraryId : `${args.libraryId}/${args.version}`
  const response = await request(
    '/context',
    { libraryId, query: args.query, type: 'json', fast: 'false' },
    deps
  )
  const body = await response.text()

  if (response.status === 404) return { status: 'library-not-found' }
  if (response.status === 202) {
    return { status: 'indexing', state: parseError(body).state ?? null }
  }
  failOnBadStatus(response, body, deps)

  const wire = parseJson<ContextResponseWire>(body, response.status)
  const docs = normalizeDocs(wire)
  return docs.snippets.length === 0 && docs.notes.length === 0
    ? { status: 'empty' }
    : { status: 'ready', docs }
}

async function request(
  path: string,
  params: Record<string, string>,
  deps: Context7Deps
): Promise<HttpResponse> {
  const url = new URL((deps.baseUrl ?? CONTEXT7_BASE_URL) + path)
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value)

  const headers: Record<string, string> = { accept: 'application/json' }
  if (deps.apiKey !== undefined && deps.apiKey !== null && deps.apiKey !== '') {
    headers.authorization = `Bearer ${deps.apiKey}`
  }

  const timeout = AbortSignal.timeout(CONTEXT7_TIMEOUT_MS)
  const signal = deps.signal === undefined ? timeout : AbortSignal.any([deps.signal, timeout])
  return deps.fetchFn(url.href, { headers, signal })
}

// 400 and 404 never get here: they are screen state, and handing them to
// describeUpstreamError would render a typo as a system failure (D23A.3).
function failOnBadStatus(response: HttpResponse, body: string, deps: Context7Deps): void {
  if (response.status >= 200 && response.status < 300) return
  if (response.status === 429) {
    throw new UpstreamError(429, quotaMessage(response, deps))
  }
  throw new UpstreamError(response.status, describeUpstreamError(response.status, body))
}

function quotaMessage(response: HttpResponse, deps: Context7Deps): string {
  const limit = response.headers.get('ratelimit-limit')
  const quota = limit === null ? 'As consultas mensais' : `As ${limit} consultas mensais`
  const owner = hasKey(deps) ? 'da sua chave do Context7' : 'gratuitas do Context7'
  const back = resetDate(response.headers.get('ratelimit-reset'))
  const when = back === null ? 'A cota volta na virada do mês.' : `A cota volta em ${back}.`
  // The two halves of situations 5 and 6: without a key there is something to
  // do about it, with one there is only waiting.
  const fix = hasKey(deps) ? '' : ' Uma chave do Context7 aumenta o limite.'
  return `${quota} ${owner} acabaram. ${when}${fix}`
}

function hasKey(deps: Context7Deps): boolean {
  return deps.apiKey !== undefined && deps.apiKey !== null && deps.apiKey !== ''
}

// `Ratelimit-Reset` came as an epoch pointing at the turn of the month UTC,
// so the message answers *when it comes back* instead of "limit reached"
// (D23A.11). Local time, with the hour: the boundary lands mid-evening the day
// before here, and naming the UTC date would send the user away for an extra
// day of a quota they already have back.
function resetDate(header: string | null): string | null {
  const epoch = Number(header)
  if (header === null || !Number.isFinite(epoch) || epoch <= 0) return null
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(epoch * 1000))
}

function parseError(body: string): { message?: string; state?: string } {
  try {
    const parsed = JSON.parse(body) as ErrorBodyWire & { state?: string }
    return { message: parsed.message, state: parsed.state }
  } catch {
    return {}
  }
}

function parseJson<T>(body: string, status: number): T {
  try {
    return JSON.parse(body) as T
  } catch {
    throw new UpstreamError(status, 'O Context7 respondeu num formato inesperado.')
  }
}
