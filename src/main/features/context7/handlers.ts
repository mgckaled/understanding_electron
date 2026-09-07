import type { Args, AppError, ContextOutcome, Result, SearchOutcome } from '@shared/ipc'
import type { Context7Fetch } from '@core/context7/types'
import type { DocsCache } from './cache'
import { UpstreamError } from '@core/ai/types'
import { CONTEXT7_TIMEOUT_MS, fetchLibraryContext, searchLibraries } from '@core/context7/client'
import { ok, err } from '@core/result'

/** What register-all.ts injects: the real fetch, and the key read fresh (D23B.7). */
export type DocsDeps = {
  fetchFn: Context7Fetch
  getApiKey: () => string | null
  cache: DocsCache
}

const UNAVAILABLE_HINT = 'Verifique sua conexão — o Context7 é um serviço online.'

/**
 * Libraries matching what the user typed, in the app's own order.
 *
 * @returns A miss (`no-libraries`) inside the value, never as an error: it is
 *   screen state, and rendering a typo as a system failure is what D23A.3
 *   exists to prevent.
 */
export async function searchDocs(
  args: Args<'docs:search'>,
  deps: DocsDeps
): Promise<Result<SearchOutcome>> {
  const key = `search|${args.query}`
  const cached = deps.cache.get(key) as SearchOutcome | undefined
  if (cached !== undefined) return ok(cached)

  try {
    const outcome = await searchLibraries(args.query, clientDeps(deps))
    if (outcome.status === 'found') deps.cache.set(key, outcome)
    return ok(outcome)
  } catch (error) {
    return err(mapDocsError(error))
  }
}

/**
 * One library's documentation for one question — the second, paid call.
 *
 * @returns `indexing`, `empty` and `library-not-found` inside the value, for
 *   the same reason as searchDocs.
 */
export async function fetchDocs(
  args: Args<'docs:fetch'>,
  deps: DocsDeps
): Promise<Result<ContextOutcome>> {
  const key = `fetch|${args.libraryId}|${args.version ?? ''}|${args.query}`
  const cached = deps.cache.get(key) as ContextOutcome | undefined
  if (cached !== undefined) return ok(cached)

  try {
    const outcome = await fetchLibraryContext(args, clientDeps(deps))
    if (outcome.status === 'ready') deps.cache.set(key, outcome)
    return ok(outcome)
  } catch (error) {
    return err(mapDocsError(error))
  }
}

// Only a complete answer is memoized. `indexing` is the state whose whole
// point is trying again in a few minutes; `empty`/`no-libraries` leave the
// user reformulating anyway; a failure must never stick to a retry button.
function clientDeps(deps: DocsDeps): { fetchFn: Context7Fetch; apiKey: string | null } {
  return { fetchFn: deps.fetchFn, apiKey: deps.getApiKey() }
}

// Not mapProviderError (D23B.5): that one is keyed by AiService and hands out
// hints about Ollama and model keys, and Context7 is a credential holder that
// will never be an AI provider (DN1A.5).
function mapDocsError(error: unknown): AppError {
  if (error instanceof UpstreamError) {
    return { kind: 'upstream', service: 'context7', status: error.status, message: error.message }
  }
  // The client's own 30 s ceiling, told apart from a service that never
  // answered — the panel has to name it instead of letting it look like an
  // outage (D23B.1, condição a).
  if (error instanceof Error && error.name === 'TimeoutError') {
    return { kind: 'timeout', afterMs: CONTEXT7_TIMEOUT_MS }
  }
  return { kind: 'unavailable', service: 'context7', hint: UNAVAILABLE_HINT }
}
