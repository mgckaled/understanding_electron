import { basename } from 'node:path'
import type { DatasetPart, JobEvent, JobId, Result } from '@shared/ipc'
import { ok, err } from '@core/result'
import { scanDelimited } from '@core/dataset/scan'
import { mapFsError } from '@core/fsError'
import * as jobs from '../../jobs'

const PROGRESS_INTERVAL_MS = 100

/**
 * Attaches a delimited (CSV/TSV/TXT) dataset — hash and schema read together
 * in one pass (D16.6), unchanged since plano 16/18-B. `storeAttachment` runs
 * only after the scan succeeds: a cancelled or failed read never reaches
 * disk.
 */
export async function attachDelimitedDataset(
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

    return ok({
      kind: 'dataset',
      hash,
      fileName: basename(path),
      format: 'delimited',
      ...scanned.value
    })
  } catch (error) {
    return err(mapFsError(error, path))
  } finally {
    jobs.finish(jobId)
  }
}
