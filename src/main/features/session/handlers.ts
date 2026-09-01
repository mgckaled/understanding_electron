/** Bytes of the HTTP cache only (O-5, DO5.2) — `getCacheSize` is injected, never `session` imported by value. */
export function readCacheSize(getCacheSize: () => Promise<number>): Promise<number> {
  return getCacheSize()
}

export function clearChromiumCache(clearCache: () => Promise<void>): Promise<void> {
  return clearCache()
}
