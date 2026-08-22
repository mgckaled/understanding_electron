import type { DatabaseSync } from 'node:sqlite'
import type { CloudProvider } from '@shared/ipc'
import { CLOUD_PROVIDERS } from '@shared/ipc'
import { assessSecretBackend } from '@core/ai/secrets'
import type { EncryptFn, SecretBackendInfo } from './handlers'
import { hasSecret, writeSecret } from './handlers'

const ENV_VAR_BY_PROVIDER: Record<CloudProvider, string> = {
  gemini: 'GEMINI_API_KEY',
  glm: 'GLM_API_KEY'
}

/**
 * Fills in a cloud secret from a dev-only `.env`, once, never overwriting a
 * key already written through the UI (DN1A.1).
 *
 * Stricter than `writeSecret`'s own gate: `'weak'` skips too, silently —
 * there is no UI up yet to show the DN1A.4 warning during a silent
 * boot-time seed, so it degrades to doing nothing rather than writing
 * without the warning shown.
 */
export function seedSecretsFromEnv(
  db: DatabaseSync,
  env: NodeJS.ProcessEnv,
  encrypt: EncryptFn,
  backendInfo: SecretBackendInfo
): void {
  const status = assessSecretBackend(backendInfo)
  if (status !== 'ok') {
    console.warn(`secrets seed skipped — backend is '${status}'`)
    return
  }

  for (const provider of CLOUD_PROVIDERS) {
    const apiKey = env[ENV_VAR_BY_PROVIDER[provider]]
    if (!apiKey || hasSecret({ provider }, db)) continue
    writeSecret({ provider, apiKey }, db, encrypt, backendInfo)
  }
}
