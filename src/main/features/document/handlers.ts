import { createHash } from 'node:crypto'
import { basename, extname } from 'node:path'
import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import type { DatasetRef, DocumentPart, JobEvent, JobId, Result } from '@shared/ipc'
import { ok, err } from '@core/result'
import { mapFsError } from '@core/fsError'
import { decodeText } from '@core/document/extractText'
import * as jobs from '../../jobs'

type ShowOpenDialog = (options: OpenDialogOptions) => Promise<OpenDialogReturnValue>

/**
 * Stats `path` for its size, so the progress label can show a time estimate
 * before the job opens (D17.10). Injected, like `showOpenDialog`, to keep
 * this testable without disk I/O — a stat failure is swallowed, since the
 * dialog just confirmed the file exists; missing `sizeBytes` degrades to no
 * estimate, not a picker that fails on its own follow-up read.
 */
export async function pickDocument(
  _args: void,
  showOpenDialog: ShowOpenDialog,
  statSize: (path: string) => Promise<number>
): Promise<Result<DatasetRef | null>> {
  const { canceled, filePaths } = await showOpenDialog({
    properties: ['openFile'],
    // pdf joins this filter in the step that builds its extractor (D17.14).
    filters: [{ name: 'Documento', extensions: ['txt', 'md'] }]
  })

  if (canceled || filePaths.length === 0) return ok(null)
  const path = filePaths[0]
  const sizeBytes = await statSize(path).catch(() => undefined)
  return ok({ path, sizeBytes })
}

function formatOf(path: string): 'txt' | 'md' {
  return extname(path).toLowerCase() === '.md' ? 'md' : 'txt'
}

/**
 * Reads `path` once — the bytes double as extraction input and hash source
 * (D17.2) — then stores a copy content-addressed under `attachmentsDir`
 * (D16.3) and returns the resulting part. `.pdf` joins `formatOf` and this
 * function's branching in the step that builds its own extractor (D17.14).
 */
export async function attachDocument(
  { path, jobId }: { path: string; jobId: JobId },
  readDocumentFile: (path: string, signal: AbortSignal) => Promise<Buffer>,
  attachmentsDir: string,
  storeAttachment: (dir: string, hash: string, sourcePath: string) => Promise<void>,
  emitProgress: (event: JobEvent) => void
): Promise<Result<DocumentPart>> {
  const controller = jobs.create(jobId)
  emitProgress({ jobId, type: 'progress', phase: 'reading', done: 0, total: null })

  try {
    const buffer = await readDocumentFile(path, controller.signal)
    const format = formatOf(path)
    const text = decodeText(buffer)
    const hash = createHash('sha256').update(buffer).digest('hex')
    await storeAttachment(attachmentsDir, hash, path)

    return ok({ kind: 'document', hash, fileName: basename(path), format, text })
  } catch (error) {
    if (controller.signal.aborted) return err({ kind: 'cancelled' })
    return err(mapFsError(error, path))
  } finally {
    jobs.finish(jobId)
  }
}
