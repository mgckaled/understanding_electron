import { useCallback } from 'react'
import type { SearchOutcome } from '@shared/ipc'
import { useAsyncAction } from '../../shared/hooks/useAsyncAction'
import type { ViewState } from '../../shared/ui/state'

/**
 * Resolves what the user typed to a list of libraries — the first of the two
 * paid calls (D23D.7).
 *
 * @returns The call's state, where a miss arrives as a `ready` outcome and
 *   never as an error (D23A.3).
 */
export function useDocsSearch(): {
  state: ViewState<SearchOutcome>
  search: (query: string) => Promise<void>
  reset: () => void
} {
  const { state, run, reset } = useAsyncAction<SearchOutcome>()

  const search = useCallback(
    async (query: string): Promise<void> => {
      await run(() => window.api.docs.search(query))
    },
    [run]
  )

  return { state, search, reset }
}
