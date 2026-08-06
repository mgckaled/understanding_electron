import { openExternal } from './handlers'

describe('openExternal', () => {
  it('allows https and calls the injected function once', async () => {
    const openExternalFn = vi.fn().mockResolvedValue(undefined)

    const result = await openExternal({ url: 'https://electronjs.org' }, openExternalFn)

    expect(result).toEqual({ ok: true, value: undefined })
    expect(openExternalFn).toHaveBeenCalledTimes(1)
  })

  it('allows http', async () => {
    const openExternalFn = vi.fn().mockResolvedValue(undefined)

    const result = await openExternal({ url: 'http://localhost:5173' }, openExternalFn)

    expect(result).toEqual({ ok: true, value: undefined })
  })

  it('blocks file: and never calls the injected function', async () => {
    const openExternalFn = vi.fn().mockResolvedValue(undefined)

    const result = await openExternal({ url: 'file:///C:/Windows/System32' }, openExternalFn)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('blocked')
    expect(openExternalFn).not.toHaveBeenCalled()
  })

  it('blocks javascript: and never calls the injected function', async () => {
    const openExternalFn = vi.fn().mockResolvedValue(undefined)

    const result = await openExternal({ url: 'javascript:alert(1)' }, openExternalFn)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('blocked')
    expect(openExternalFn).not.toHaveBeenCalled()
  })
})
