import type { DatabaseSync } from 'node:sqlite'
import type { Args, Result } from '@shared/ipc'
import { assessSecretBackend, secretWriteOutcome } from '@core/ai/secrets'

/** register-all.ts's read of safeStorage — Linux-only backend, null elsewhere. */
export type SecretBackendInfo = { encryptionAvailable: boolean; backend: string | null }

/** safeStorage.encryptString, injected (DIP) — this file never imports electron. */
export type EncryptFn = (plainText: string) => Uint8Array

// decryptString has no counterpart here on purpose (DN1A.3): a secrets:read
// channel does not exist, and adding a decrypt call to this file would open
// the bypass the mão única rule (CLAUDE.md § Segurança) exists to prevent.
// Decrypting for a real API call is N-1-B's job, at the point it builds one.

export function writeSecret(
  args: Args<'secrets:write'>,
  db: DatabaseSync,
  encrypt: EncryptFn,
  backendInfo: SecretBackendInfo
): Result<{ weakBackend: boolean }> {
  const outcome = secretWriteOutcome(assessSecretBackend(backendInfo))
  if (!outcome.ok) return outcome

  db.prepare(
    `INSERT INTO secrets (provider, ciphertext) VALUES (?, ?)
     ON CONFLICT(provider) DO UPDATE SET ciphertext = excluded.ciphertext`
  ).run(args.provider, encrypt(args.apiKey))

  return outcome
}

export function hasSecret(args: Args<'secrets:has'>, db: DatabaseSync): boolean {
  return db.prepare('SELECT 1 FROM secrets WHERE provider = ?').get(args.provider) !== undefined
}

export function removeSecret(args: Args<'secrets:remove'>, db: DatabaseSync): void {
  db.prepare('DELETE FROM secrets WHERE provider = ?').run(args.provider)
}
