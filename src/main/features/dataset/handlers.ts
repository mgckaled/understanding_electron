import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import type { AppError, DatasetRef, DatasetSummary, JobEvent, JobId, Result } from '@shared/ipc'
import { ok, err } from '@core/result'
import { scanDelimited } from '@core/dataset/scan'
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

function mapFsError(error: unknown, path: string): AppError {
  const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined

  if (code === 'ENOENT') return { kind: 'not-found', path }
  if (code === 'EACCES' || code === 'EPERM') return { kind: 'permission', path }
  return { kind: 'unknown', message: error instanceof Error ? error.message : String(error) }
}

export async function scanDataset(
  { path, jobId }: { path: string; jobId: JobId },
  createLineIterable: (path: string) => AsyncIterable<string>,
  emitProgress: (event: JobEvent) => void
): Promise<Result<DatasetSummary>> {
  const controller = jobs.create(jobId)
  let lastEmitAt = 0

  const onProgress = (rows: number): void => {
    const now = Date.now()
    if (now - lastEmitAt < PROGRESS_INTERVAL_MS) return
    lastEmitAt = now
    emitProgress({ jobId, type: 'progress', phase: 'scanning', done: rows, total: null })
  }

  try {
    const lines = createLineIterable(path)
    const result = await scanDelimited({ lines, onProgress, signal: controller.signal })

    if (result.ok) {
      // Guaranteed final emission: the throttle above can silently drop the
      // last sub-100ms tick, leaving the UI's progress bar short of 100%.
      emitProgress({
        jobId,
        type: 'progress',
        phase: 'scanning',
        done: result.value.rowCount,
        total: result.value.rowCount
      })
    }

    return result
  } catch (error) {
    return err(mapFsError(error, path))
  } finally {
    jobs.finish(jobId)
  }
}
