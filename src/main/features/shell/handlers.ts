import type { Result } from '@shared/ipc'

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

export async function openExternal(
  { url }: { url: string },
  openExternalFn: (url: string) => Promise<void>
): Promise<Result<void>> {
  let protocol: string
  try {
    protocol = new URL(url).protocol
  } catch {
    return { ok: false, error: { kind: 'blocked', reason: `URL inválida: ${url}` } }
  }

  if (!ALLOWED_PROTOCOLS.has(protocol)) {
    return { ok: false, error: { kind: 'blocked', reason: `esquema não permitido: ${protocol}` } }
  }

  await openExternalFn(url)
  return { ok: true, value: undefined }
}
