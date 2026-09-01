/** What `ipcStats`'s sink hands to whoever persists it (O-6, DO6.2). */
export type IpcCallEvent = {
  channel: string
  durationMs: number
  error: string | null
  domainId: string | null
}

/**
 * A resolved value that failed without throwing — the shape of `Result<T>`
 * from `shared/ipc.ts` (`{ ok: false, error: AppError }`). Most user-visible
 * failures (Ollama down, cancelled job) are Results, not exceptions (per the
 * `ipc` skill's own rule) — a sink that only watched `catch` would log almost
 * nothing (O-6, DO6.10, found live: killing Ollama mid-chat produced zero
 * error rows before this check existed).
 */
export function resultError(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('ok' in value)) return null
  if ((value as { ok: unknown }).ok !== false) return null
  const error = (value as { error?: unknown }).error
  if (typeof error === 'object' && error !== null && 'kind' in error) {
    return String((error as { kind: unknown }).kind)
  }
  return 'unknown'
}

const DOMAIN_ID_KEYS = ['conversationId', 'messageId', 'jobId'] as const

/**
 * Picks the domain identity of an IPC call, checking `conversationId` before
 * `messageId` before `jobId` (DO6.3) — a call with no such key (`app:info`,
 * `session:cacheSize`…) has no owner, and `null` says that honestly.
 */
export function extractDomainId(args: unknown): string | null {
  if (typeof args !== 'object' || args === null) return null
  const record = args as Record<string, unknown>
  for (const key of DOMAIN_ID_KEYS) {
    const value = record[key]
    if (typeof value === 'string') return value
  }
  return null
}
