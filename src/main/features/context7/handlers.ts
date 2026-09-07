import type { Args, AppError, ContextOutcome, Result, SearchOutcome } from '@shared/ipc'
import type { Context7Fetch } from '@core/context7/types'
import { UpstreamError } from '@core/ai/types'
import { CONTEXT7_TIMEOUT_MS, fetchLibraryContext, searchLibraries } from '@core/context7/client'
import { ok, err } from '@core/result'

/** What register-all.ts injects: the real fetch, and the key read fresh (D23B.7). */
export type DocsDeps = {
  fetchFn: Context7Fetch
  getApiKey: () => string | null
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
  try {
    return ok(await searchLibraries(args.query, clientDeps(deps)))
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
  try {
    return ok(await fetchLibraryContext(args, clientDeps(deps)))
  } catch (error) {
    return err(mapDocsError(error))
  }
}

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
