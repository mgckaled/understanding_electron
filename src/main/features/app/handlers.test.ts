import { getAppInfo, getSystemMemory } from './handlers'

describe('getSystemMemory', () => {
  it('reports what the readers return, in bytes', () => {
    const free = vi.fn().mockReturnValue(6 * 1024 ** 3)
    const total = vi.fn().mockReturnValue(16 * 1024 ** 3)

    expect(getSystemMemory(free, total)).toEqual({
      freeBytes: 6 * 1024 ** 3,
      totalBytes: 16 * 1024 ** 3
    })
  })

  it('reads on every call instead of caching', () => {
    // There is no single "free RAM" on this machine — ~9 GB with only the app
    // running, ~6 GB with the working environment open. A value read once at
    // startup would be wrong for the rest of the session, and the context
    // ceiling derived from it would be wrong in the dangerous direction.
    const free = vi
      .fn()
      .mockReturnValueOnce(9 * 1024 ** 3)
      .mockReturnValueOnce(6 * 1024 ** 3)
    const total = vi.fn().mockReturnValue(16 * 1024 ** 3)

    expect(getSystemMemory(free, total).freeBytes).toBe(9 * 1024 ** 3)
    expect(getSystemMemory(free, total).freeBytes).toBe(6 * 1024 ** 3)
  })
})

describe('getAppInfo', () => {
  it('returns the expected shape', () => {
    const getVersion = vi.fn().mockReturnValue('1.0.0')

    const info = getAppInfo(getVersion, true)

    expect(info).toEqual({
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      app: '1.0.0',
      platform: process.platform,
      isDev: true
    })
  })
})
