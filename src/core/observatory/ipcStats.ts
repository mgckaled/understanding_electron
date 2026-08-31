import type { AppIpcStat } from '@shared/ipc'

/**
 * Wraps every IPC handler with a call counter, sticky on failure (DO2.4): a
 * later success does not clear `lastError`, since the point of the counter is
 * to answer "did this channel ever fail, and when" even after it recovers.
 */
export function createIpcStatsStore(now: () => number = () => performance.now()): {
  wrap: <A, R>(channel: string, fn: (args: A) => Promise<R> | R) => (args: A) => Promise<R>
  snapshot: () => AppIpcStat[]
} {
  const stats = new Map<string, AppIpcStat>()

  function record(channel: string, durationMs: number, error: string | null): void {
    const prev = stats.get(channel)
    stats.set(channel, {
      channel,
      callCount: (prev?.callCount ?? 0) + 1,
      errorCount: (prev?.errorCount ?? 0) + (error ? 1 : 0),
      lastDurationMs: durationMs,
      lastError: error ?? prev?.lastError ?? null
    })
  }

  return {
    wrap(channel, fn) {
      return async (args) => {
        const start = now()
        try {
          const result = await fn(args)
          record(channel, now() - start, null)
          return result
        } catch (error) {
          record(channel, now() - start, error instanceof Error ? error.message : String(error))
          throw error
        }
      }
    },
    snapshot() {
      return [...stats.values()].sort((a, b) => b.callCount - a.callCount)
    }
  }
}
