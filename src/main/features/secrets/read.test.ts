import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../../db/open'
import { writeSecret } from './handlers'
import { readSecretForUse } from './read'

let db: DatabaseSync

beforeEach(() => {
  db = openDatabase(':memory:')
})

afterEach(() => {
  db.close()
})

const OK_BACKEND = { encryptionAvailable: true, backend: null }

function fakeEncrypt(plainText: string): Uint8Array {
  return Buffer.from(`enc:${plainText}`)
}

function fakeDecrypt(ciphertext: Uint8Array): string {
  return Buffer.from(ciphertext).toString().replace(/^enc:/, '')
}

describe('readSecretForUse', () => {
  it('decrypts the stored key for the given provider', () => {
    writeSecret({ provider: 'glm', apiKey: 'sk-glm' }, db, fakeEncrypt, OK_BACKEND)

    expect(readSecretForUse('glm', db, fakeDecrypt)).toBe('sk-glm')
  })

  it('returns null for a provider with no stored key, without calling decrypt', () => {
    const decrypt = vi.fn(fakeDecrypt)

    expect(readSecretForUse('glm', db, decrypt)).toBeNull()
    expect(decrypt).not.toHaveBeenCalled()
  })
})
