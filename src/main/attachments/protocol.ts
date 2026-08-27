import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { protocol } from 'electron'
import { isAttachmentHash } from '@core/attachments/hash'
import { sniffImageMimeType } from '@core/image/sniff'

export const ATTACHMENT_SCHEME = 'attachment'

/**
 * Declares the scheme's privileges — `standard`/`secure`/`supportFetchAPI`
 * let `<img src="attachment://<hash>">` load like any ordinary resource
 * (D17.6). Must run before `app.whenReady()`, exactly once — called from
 * main/index.ts at module scope, not from here.
 */
export function registerAttachmentScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ATTACHMENT_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true }
    }
  ])
}

/**
 * Serves an attachment blob by hash — the renderer's only path to attachment
 * bytes, since it has no `fs` (sandboxed). The blob's filename carries no
 * extension (D16.3), so the Content-Type comes from sniffing magic bytes
 * (D17.6), not from the URL.
 */
export function handleAttachmentProtocol(attachmentsDir: string): void {
  protocol.handle(ATTACHMENT_SCHEME, async (request) => {
    const hash = new URL(request.url).hostname
    if (!isAttachmentHash(hash)) return new Response('bad hash', { status: 400 })

    try {
      const bytes = await readFile(join(attachmentsDir, hash))
      const mimeType = sniffImageMimeType(bytes)
      if (mimeType === null) return new Response('unrecognized format', { status: 400 })
      return new Response(bytes, { headers: { 'content-type': mimeType } })
    } catch {
      return new Response('not found', { status: 404 })
    }
  })
}
