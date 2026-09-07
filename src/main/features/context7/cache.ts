/**
 * Per-session memo of answers already paid for (D23B.10).
 *
 * The scarce resource of this feature is the monthly quota, and the panel's
 * `Consultar de novo` plus a reopened panel would spend it on a question
 * already answered. Bounded and in memory only: documentation is not worth
 * persisting, and a restart is a cheap way to force a fresh look.
 */
export type DocsCache = {
  get(key: string): unknown | undefined
  set(key: string, value: unknown): void
}

const MAX_ENTRIES = 20

export function createDocsCache(max: number = MAX_ENTRIES): DocsCache {
  const entries = new Map<string, unknown>()
  return {
    get: (key) => entries.get(key),
    set: (key, value) => {
      // Re-inserting moves the key to the end, so the eviction below drops the
      // least recently WRITTEN, never the entry just asked for.
      entries.delete(key)
      entries.set(key, value)
      if (entries.size > max) entries.delete(entries.keys().next().value as string)
    }
  }
}
