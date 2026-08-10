import { useQuery } from '@tanstack/react-query'
import type { SystemMemory } from '@shared/ipc'

const MEMORY_KEY = ['app', 'memory'] as const

/**
 * How much memory the machine has free, for costing a context window (D15.2).
 *
 * It inherits the client's `staleTime: Infinity`, which is deliberate rather
 * than lazy: a ceiling that moved on its own would change under the user's
 * cursor while they drag the control. What matters is that the figure is read
 * WHEN THE APP OPENS instead of being written into the source — this machine
 * reports ~6 GB in the working environment and ~9 GB with only the app running,
 * and a constant chosen from either is wrong in the other.
 *
 * `undefined` while it is in flight; callers treat that as "cannot cost yet"
 * rather than substituting a guess.
 */
export function useSystemMemory(): SystemMemory | undefined {
  const { data } = useQuery({ queryKey: MEMORY_KEY, queryFn: () => window.api.app.memory() })
  return data
}
