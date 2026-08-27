import { createHash } from 'node:crypto'
import { basename, join } from 'node:path'
import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import type { DatasetRef, ImagePart, JobEvent, JobId, Result } from '@shared/ipc'
import { isAttachmentHash } from '@core/attachments/hash'
import { ok, err } from '@core/result'
import { mapFsError } from '@core/fsError'
import { sniffImageMimeType, sniffRasterFormat, type RasterFormat } from '@core/image/sniff'
import * as jobs from '../../jobs'

type ShowOpenDialog = (options: OpenDialogOptions) => Promise<OpenDialogReturnValue>

export async function pickImage(
  _args: void,
  showOpenDialog: ShowOpenDialog
): Promise<Result<DatasetRef | null>> {
  const { canceled, filePaths } = await showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Imagem', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }]
  })

  if (canceled || filePaths.length === 0) return ok(null)
  return ok({ path: filePaths[0] })
}

/**
 * Reads `path` once — hash and format sniff off the same bytes. PNG/JPEG
 * store the bytes read; SVG/WebP rasterize to PNG first (D17.7) and store
 * THAT — so the resulting part always has a PNG/JPEG `mimeType`, never the
 * source format. No content extraction beyond that: an image rides verbatim,
 * read fresh from disk on every send (D17.2), never inlined into the row.
 */
export async function attachImage(
  { path, jobId }: { path: string; jobId: JobId },
  readImageFile: (path: string, signal: AbortSignal) => Promise<Buffer>,
  attachmentsDir: string,
  storeAttachment: (dir: string, hash: string, sourcePath: string) => Promise<void>,
  emitProgress: (event: JobEvent) => void,
  rasterize: (bytes: Buffer, format: RasterFormat) => Promise<Buffer>,
  storeAttachmentBytes: (dir: string, hash: string, bytes: Buffer) => Promise<void>
): Promise<Result<ImagePart>> {
  const controller = jobs.create(jobId)
  emitProgress({ jobId, type: 'progress', phase: 'reading', done: 0, total: null })

  try {
    const buffer = await readImageFile(path, controller.signal)
    const fileName = basename(path)

    const directMimeType = sniffImageMimeType(buffer)
    if (directMimeType !== null) {
      const hash = createHash('sha256').update(buffer).digest('hex')
      await storeAttachment(attachmentsDir, hash, path)
      return ok({ kind: 'image', hash, fileName, mimeType: directMimeType })
    }

    const rasterFormat = sniffRasterFormat(buffer)
    if (rasterFormat !== null) {
      const png = await rasterize(buffer, rasterFormat)
      const hash = createHash('sha256').update(png).digest('hex')
      await storeAttachmentBytes(attachmentsDir, hash, png)
      return ok({ kind: 'image', hash, fileName, mimeType: 'image/png' })
    }

    return err({
      kind: 'blocked',
      reason: 'Formato de imagem não reconhecido — só PNG, JPEG, SVG e WebP são aceitos aqui.'
    })
  } catch (error) {
    if (controller.signal.aborted) return err({ kind: 'cancelled' })
    return err(mapFsError(error, path))
  } finally {
    jobs.finish(jobId)
  }
}

/**
 * The stored blob's bytes, addressed by hash.
 *
 * @param readFile - Injected so the handler stays callable in plain Node.
 * @returns The bytes, or `not-found` when the blob was already swept by
 *   `collectOrphanedAttachments`.
 */
export async function readImageBytes(
  { hash }: { hash: string },
  attachmentsDir: string,
  readFile: (path: string) => Promise<Buffer>
): Promise<Result<Uint8Array>> {
  // Rejected before the path is built, never after: the hash is a filename
  // segment, and `join` would happily resolve `..`.
  if (!isAttachmentHash(hash)) {
    return err({ kind: 'blocked', reason: 'Identificador de anexo inválido.' })
  }

  const path = join(attachmentsDir, hash)
  try {
    return ok(await readFile(path))
  } catch (error) {
    return err(mapFsError(error, path))
  }
}
