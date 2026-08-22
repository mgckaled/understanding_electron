import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../../db/open'
import { hasSecret, writeSecret } from './handlers'
import { seedSecretsFromEnv } from './seed'

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

function ciphertextOf(provider: string): string {
  const row = db.prepare('SELECT ciphertext FROM secrets WHERE provider = ?').get(provider)
  return Buffer.from(row?.['ciphertext'] as Uint8Array).toString()
}

describe('seedSecretsFromEnv', () => {
  it('fills a key from the environment when none is stored yet', () => {
    seedSecretsFromEnv(db, { GEMINI_API_KEY: 'sk-x' }, fakeEncrypt, OK_BACKEND)

    expect(hasSecret({ provider: 'gemini' }, db)).toBe(true)
  })

  it('never overwrites a key already written — the D14.1-style proof of DN1A.1', () => {
    writeSecret({ provider: 'gemini', apiKey: 'from-ui' }, db, fakeEncrypt, OK_BACKEND)

    seedSecretsFromEnv(db, { GEMINI_API_KEY: 'from-env' }, fakeEncrypt, OK_BACKEND)

    expect(ciphertextOf('gemini')).toBe('enc:from-ui')
  })

  it('leaves a provider alone when its env var is unset', () => {
    seedSecretsFromEnv(db, {}, fakeEncrypt, OK_BACKEND)

    expect(hasSecret({ provider: 'gemini' }, db)).toBe(false)
    expect(hasSecret({ provider: 'glm' }, db)).toBe(false)
  })

  it('seeds both providers, each from its own env var', () => {
    seedSecretsFromEnv(db, { GEMINI_API_KEY: 'g', GLM_API_KEY: 'z' }, fakeEncrypt, OK_BACKEND)

    expect(hasSecret({ provider: 'gemini' }, db)).toBe(true)
    expect(hasSecret({ provider: 'glm' }, db)).toBe(true)
  })

  it('skips silently on a weak backend — stricter than the UI path, which still writes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    seedSecretsFromEnv(db, { GEMINI_API_KEY: 'sk-x' }, fakeEncrypt, WEAK_BACKEND)

    expect(hasSecret({ provider: 'gemini' }, db)).toBe(false)
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('skips silently when encryption is unavailable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    seedSecretsFromEnv(db, { GEMINI_API_KEY: 'sk-x' }, fakeEncrypt, UNAVAILABLE_BACKEND)

    expect(hasSecret({ provider: 'gemini' }, db)).toBe(false)
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})
