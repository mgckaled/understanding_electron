import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../../db/open'
import { hasSecret, removeSecret, writeSecret } from './handlers'

let db: DatabaseSync

beforeEach(() => {
  db = openDatabase(':memory:')
})

afterEach(() => {
  db.close()
})

const OK_BACKEND = { encryptionAvailable: true, backend: null }
const WEAK_BACKEND = { encryptionAvailable: true, backend: 'basic_text' }
const UNAVAILABLE_BACKEND = { encryptionAvailable: false, backend: null }

function fakeEncrypt(plainText: string): Uint8Array {
  return Buffer.from(`enc:${plainText}`)
}

describe('writeSecret', () => {
  it('encrypts and stores the key, reporting weakBackend: false on a real backend', () => {
    const result = writeSecret({ provider: 'gemini', apiKey: 'sk-x' }, db, fakeEncrypt, OK_BACKEND)

    expect(result).toEqual({ ok: true, value: { weakBackend: false } })
    const row = db.prepare('SELECT ciphertext FROM secrets WHERE provider = ?').get('gemini')
    expect(Buffer.from(row?.['ciphertext'] as Uint8Array).toString()).toBe('enc:sk-x')
  })

  it('still writes on a weak (basic_text) backend, but reports it', () => {
    const result = writeSecret({ provider: 'glm', apiKey: 'sk-y' }, db, fakeEncrypt, WEAK_BACKEND)

    expect(result).toEqual({ ok: true, value: { weakBackend: true } })
    expect(hasSecret({ provider: 'glm' }, db)).toBe(true)
  })

  it('refuses to write when encryption is unavailable, and never calls encrypt', () => {
    const encrypt = vi.fn(fakeEncrypt)

    const result = writeSecret(
      { provider: 'gemini', apiKey: 'sk-x' },
      db,
      encrypt,
      UNAVAILABLE_BACKEND
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('unavailable')
    expect(encrypt).not.toHaveBeenCalled()
    expect(hasSecret({ provider: 'gemini' }, db)).toBe(false)
  })

  it('overwrites rather than accumulating rows for the same provider', () => {
    writeSecret({ provider: 'gemini', apiKey: 'first' }, db, fakeEncrypt, OK_BACKEND)
    writeSecret({ provider: 'gemini', apiKey: 'second' }, db, fakeEncrypt, OK_BACKEND)

    expect(db.prepare('SELECT COUNT(*) AS n FROM secrets').get()?.['n']).toBe(1)
    const row = db.prepare('SELECT ciphertext FROM secrets WHERE provider = ?').get('gemini')
    expect(Buffer.from(row?.['ciphertext'] as Uint8Array).toString()).toBe('enc:second')
  })
})

describe('hasSecret', () => {
  it('is false for a provider that was never written', () => {
    expect(hasSecret({ provider: 'gemini' }, db)).toBe(false)
  })

  it('is true once a key is written', () => {
    writeSecret({ provider: 'gemini', apiKey: 'sk-x' }, db, fakeEncrypt, OK_BACKEND)
    expect(hasSecret({ provider: 'gemini' }, db)).toBe(true)
  })
})

describe('removeSecret', () => {
  it('deletes the stored key', () => {
    writeSecret({ provider: 'gemini', apiKey: 'sk-x' }, db, fakeEncrypt, OK_BACKEND)

    removeSecret({ provider: 'gemini' }, db)

    expect(hasSecret({ provider: 'gemini' }, db)).toBe(false)
  })

  it('does not throw when the provider has no stored key', () => {
    expect(() => removeSecret({ provider: 'glm' }, db)).not.toThrow()
  })
})
