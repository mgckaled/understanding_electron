/** What `ipcStats`'s sink hands to whoever persists it (O-6, DO6.2). */
export type IpcCallEvent = {
  channel: string
  durationMs: number
  error: string | null
  domainId: string | null
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
