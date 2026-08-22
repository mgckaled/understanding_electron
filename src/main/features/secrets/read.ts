import type { DatabaseSync } from 'node:sqlite'
import type { CloudProvider } from '@shared/ipc'

/** safeStorage.decryptString, injected (DIP) — this file never imports electron. */
export type DecryptFn = (ciphertext: Uint8Array) => string

/**
 * Decrypts the stored key for `provider`, for a main-only caller building a
 * real HTTP call (N-1-B, DN1B.4) — never wired to `handle()`. There is no
 * `secrets:read` channel (DN1A.3, mão única is about what the renderer can
 * reach); main already has full DB access, so this is not the bypass that
 * rule exists to prevent.
 */
export function readSecretForUse(
  provider: CloudProvider,
  db: DatabaseSync,
  decrypt: DecryptFn
): string | null {
  const row = db.prepare('SELECT ciphertext FROM secrets WHERE provider = ?').get(provider) as
    { ciphertext: Uint8Array } | undefined
  return row === undefined ? null : decrypt(row.ciphertext)
}
