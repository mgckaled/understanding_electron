import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { SystemMemory } from '@shared/ipc'

const MEMORY_KEY = ['app', 'memory'] as const

/**
 * How much memory the machine has free, for costing a context window (D15.2).
 *
 * It inherits the client's `staleTime: Infinity` — a ceiling that moved on its
 * own would change under the user's cursor while dragging the control — so
 * freeing memory only counts once `reload` is called. Reading it at all is the
 * point: this machine reports ~6 GB in the working environment and ~9 GB with
 * only the app running, and a constant chosen from either is wrong in the other.
 *
 * `memory` is undefined while in flight; callers treat that as "cannot cost yet"
 * rather than substituting a guess.
 */
export function useSystemMemory(): {
  memory: SystemMemory | undefined
  reload: () => void
} {
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: MEMORY_KEY, queryFn: () => window.api.app.memory() })

  const reload = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: MEMORY_KEY })
  }, [queryClient])

  return useMemo(() => ({ memory: data, reload }), [data, reload])
}
