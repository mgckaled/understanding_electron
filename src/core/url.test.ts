import { checkExternalUrl } from './url'

describe('checkExternalUrl', () => {
  it.each(['https://electronjs.org', 'http://localhost:5173'])('allows %s', (url) => {
    expect(checkExternalUrl(url)).toEqual({ ok: true, value: url })
  })

  // Each of these reaches a local handler through shell.openExternal — file:
  // and smb: touch the filesystem, ms-msdt: is the Follina vector, and
  // javascript: is the classic renderer escape.
  it.each([
    'file:///C:/Windows/System32',
    'javascript:alert(1)',
    'ms-msdt:/id',
    'smb://host/share'
  ])('blocks %s', (url) => {
    const result = checkExternalUrl(url)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('blocked')
  })

  it('blocks a string that is not a URL at all', () => {
    const result = checkExternalUrl('not a url')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('blocked')
  })
})
