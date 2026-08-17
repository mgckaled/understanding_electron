import { basename } from 'node:path'
import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import type { DatasetPart, DatasetRef, JobEvent, JobId, Result } from '@shared/ipc'
import { ok, err } from '@core/result'
import { scanDelimited } from '@core/dataset/scan'
import { mapFsError } from '@core/fsError'
import * as jobs from '../../jobs'

const PROGRESS_INTERVAL_MS = 100

type ShowOpenDialog = (options: OpenDialogOptions) => Promise<OpenDialogReturnValue>

export async function pickDataset(
  _args: void,
  showOpenDialog: ShowOpenDialog
): Promise<Result<DatasetRef | null>> {
  const { canceled, filePaths } = await showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Delimited text', extensions: ['csv', 'tsv', 'txt'] }]
  })

  if (canceled || filePaths.length === 0) return ok(null)
  return ok({ path: filePaths[0] })
}

/**
 * Reads `path` once — hash and schema together (D16.6) — then stores a copy
 * content-addressed under `attachmentsDir` (D16.3) and returns the resulting
 * part, ready to ride on a message. `storeAttachment` runs only after the
 * scan succeeds: a cancelled or failed read never reaches disk.
 */
export async function attachDataset(
  { path, jobId }: { path: string; jobId: JobId },
  createHashedLines: (path: string) => { lines: AsyncIterable<string>; digest: () => string },
  attachmentsDir: string,
  storeAttachment: (dir: string, hash: string, sourcePath: string) => Promise<void>,
  emitProgress: (event: JobEvent) => void
): Promise<Result<DatasetPart>> {
  const controller = jobs.create(jobId)
  let lastEmitAt = 0

  const onProgress = (rows: number): void => {
    const now = Date.now()
    if (now - lastEmitAt < PROGRESS_INTERVAL_MS) return
    lastEmitAt = now
    emitProgress({ jobId, type: 'progress', phase: 'scanning', done: rows, total: null })
  }

  try {
    const { lines, digest } = createHashedLines(path)
    const scanned = await scanDelimited({ lines, onProgress, signal: controller.signal })
    if (!scanned.ok) return scanned

    emitProgress({
      jobId,
      type: 'progress',
      phase: 'scanning',
      done: scanned.value.rowCount,
      total: scanned.value.rowCount
    })

    const hash = digest()
    await storeAttachment(attachmentsDir, hash, path)

    return ok({ kind: 'dataset', hash, fileName: basename(path), ...scanned.value })
  } catch (error) {
    return err(mapFsError(error, path))
  } finally {
    jobs.finish(jobId)
  }
}
