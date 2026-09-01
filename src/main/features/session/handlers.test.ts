import { readCacheSize, clearChromiumCache } from './handlers'

describe('readCacheSize', () => {
  it('returns what the injected reader reports', async () => {
    const getCacheSize = vi.fn().mockResolvedValue(127_452_694)

    expect(await readCacheSize(getCacheSize)).toBe(127_452_694)
  })
})

describe('clearChromiumCache', () => {
  it('calls the injected clearer', async () => {
    const clearCache = vi.fn().mockResolvedValue(undefined)

    await clearChromiumCache(clearCache)

    expect(clearCache).toHaveBeenCalledOnce()
  })
})
