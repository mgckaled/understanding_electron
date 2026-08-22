import type { Result } from '@shared/ipc'
import { ok, err } from '../result'

export type SecretBackendStatus = 'ok' | 'weak' | 'unavailable'

/**
 * Classifies what `safeStorage` can actually promise on this machine
 * (DN1A.4). `backend` is `safeStorage.getSelectedStorageBackend()` — Linux
 * only, `null` everywhere else (the binding does not exist on win32/macOS,
 * calling it there throws). `'basic_text'` is Electron's own fallback name
 * for "no secret store found, encrypting with a hardcoded password" — it
 * still reports `encryptionAvailable: true`, which is why that flag alone
 * cannot answer this question.
 */
export function assessSecretBackend({
  encryptionAvailable,
  backend
}: {
  encryptionAvailable: boolean
  backend: string | null
}): SecretBackendStatus {
  if (!encryptionAvailable) return 'unavailable'
  return backend === 'basic_text' ? 'weak' : 'ok'
}

/**
 * The `secrets:write` Result for one backend status (DN1A.4) —
 * `weakBackend: true` on SUCCESS is the Linux `basic_text` warning, never an
 * AppError, which stays reserved for `'unavailable'`, the one status that
 * blocks the write outright.
 */
export function secretWriteOutcome(status: SecretBackendStatus): Result<{ weakBackend: boolean }> {
  if (status === 'unavailable') {
    return err({
      kind: 'unavailable',
      service: 'secrets',
      hint: 'A criptografia do sistema operacional não está disponível nesta máquina.'
    })
  }
  return ok({ weakBackend: status === 'weak' })
}
