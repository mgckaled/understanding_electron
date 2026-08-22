import { assessSecretBackend, secretWriteOutcome } from './secrets'

describe('assessSecretBackend', () => {
  it('is unavailable when the OS reports no encryption at all', () => {
    expect(assessSecretBackend({ encryptionAvailable: false, backend: null })).toBe('unavailable')
  })

  it('is weak on Linux basic_text, even though encryption reports available', () => {
    // Electron's own inversion (DN1A.4): isEncryptionAvailable() is true here —
    // it is a hardcoded plaintext password, not "no encryption".
    expect(assessSecretBackend({ encryptionAvailable: true, backend: 'basic_text' })).toBe('weak')
  })

  it('is ok on a real Linux secret store', () => {
    expect(assessSecretBackend({ encryptionAvailable: true, backend: 'gnome_libsecret' })).toBe(
      'ok'
    )
  })

  it('is ok when there is no Linux backend to report (win32/macOS)', () => {
    expect(assessSecretBackend({ encryptionAvailable: true, backend: null })).toBe('ok')
  })
})

describe('secretWriteOutcome', () => {
  it('fails with an unavailable AppError, never weakBackend', () => {
    const result = secretWriteOutcome('unavailable')

    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toEqual({
        kind: 'unavailable',
        service: 'secrets',
        hint: expect.any(String)
      })
  })

  it('succeeds with weakBackend: true for a weak backend', () => {
    expect(secretWriteOutcome('weak')).toEqual({ ok: true, value: { weakBackend: true } })
  })

  it('succeeds with weakBackend: false for an ok backend', () => {
    expect(secretWriteOutcome('ok')).toEqual({ ok: true, value: { weakBackend: false } })
  })
})
