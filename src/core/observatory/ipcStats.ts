import type { AppIpcStat } from '@shared/ipc'
import { extractDomainId, resultError, type IpcCallEvent } from './events'

/**
 * Wraps every IPC handler with a call counter, sticky on failure (DO2.4): a
 * later success does not clear `lastError`, since the point of the counter is
 * to answer "did this channel ever fail, and when" even after it recovers.
 */
export function createIpcStatsStore(now: () => number = () => performance.now()): {
  wrap: <A, R>(channel: string, fn: (args: A) => Promise<R> | R) => (args: A) => Promise<R>
  snapshot: () => AppIpcStat[]
  /** O-6: the sink is read fresh on every call, so it can be set any time before real use. */
  setEventSink: (sink: (event: IpcCallEvent) => void) => void
} {
  const stats = new Map<string, AppIpcStat>()
  let eventSink: ((event: IpcCallEvent) => void) | undefined

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

  function emitEvent(
    channel: string,
    durationMs: number,
    error: string | null,
    args: unknown
  ): void {
    eventSink?.({ channel, durationMs, error, domainId: extractDomainId(args) })
  }

  return {
    wrap(channel, fn) {
      return async (args) => {
        const start = now()
        try {
          const result = await fn(args)
          const durationMs = now() - start
          // A Result-returning channel counts as a failure here too (DO6.11):
          // most user-visible failures never throw — they resolve
          // { ok: false }, per the ipc skill's own Result-vs-exception rule.
          const error = resultError(result)
          record(channel, durationMs, error)
          emitEvent(channel, durationMs, error, args)
          return result
        } catch (error) {
          const durationMs = now() - start
          const message = error instanceof Error ? error.message : String(error)
          record(channel, durationMs, message)
          emitEvent(channel, durationMs, message, args)
          throw error
        }
      }
    },
    snapshot() {
      return [...stats.values()].sort((a, b) => b.callCount - a.callCount)
    },
    setEventSink(sink) {
      eventSink = sink
    }
  }
}
