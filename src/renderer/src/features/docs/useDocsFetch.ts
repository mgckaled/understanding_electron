import { useCallback } from 'react'
import type { ContextOutcome } from '@shared/ipc'
import { useAsyncAction } from '../../shared/hooks/useAsyncAction'
import type { ViewState } from '../../shared/ui/state'

/**
 * Fetches one library's documentation — the second of the two paid calls, and
 * the one whose reranking costs seconds on their side (DM-18).
 *
 * @returns The call's state, where `empty`, `indexing` and `library-not-found`
 *   arrive as `ready` outcomes and never as errors (D23A.3).
 */
export function useDocsFetch(): {
  state: ViewState<ContextOutcome>
  fetch: (args: { libraryId: string; query: string; version?: string }) => Promise<void>
  reset: () => void
} {
  const { state, run, reset } = useAsyncAction<ContextOutcome>()

  const fetch = useCallback(
    async (args: { libraryId: string; query: string; version?: string }): Promise<void> => {
      await run(() => window.api.docs.fetch(args))
    },
    [run]
  )

  return { state, fetch, reset }
}
