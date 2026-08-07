import type { Result } from '@shared/ipc'
import { ok, err } from './result'

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * Validates a URL before it is handed to the operating system.
 *
 * `shell.openExternal` does not open a browser — it asks the OS to resolve the
 * scheme, and the OS honours every registered protocol handler. On Windows that
 * turns an unchecked URL into the invocation of an arbitrary local handler, not
 * a navigation. The allow-list is therefore a security boundary, and it only
 * holds if it has no bypass: every caller goes through this function — the IPC
 * handler, `setWindowOpenHandler` and `will-navigate`.
 *
 * Lives in core/ rather than next to the IPC handler precisely because main/
 * needs it too, and a copy in the second call site is how the bypass appeared
 * in the first place. See docs/HISTORY.md.
 */
export function checkExternalUrl(url: string): Result<string> {
  let protocol: string
  try {
    protocol = new URL(url).protocol
  } catch {
    return err({ kind: 'blocked', reason: `URL inválida: ${url}` })
  }

  if (!ALLOWED_PROTOCOLS.has(protocol)) {
    return err({ kind: 'blocked', reason: `esquema não permitido: ${protocol}` })
  }

  return ok(url)
}
