import { basename } from 'node:path'
import type { DatasetPart, JobEvent, JobId, Result } from '@shared/ipc'
import { ok, err } from '@core/result'
import { mapFsError } from '@core/fsError'
import * as jobs from '../../jobs'

const PROGRESS_INTERVAL_MS = 100

/**
 * Attaches a JSON/NDJSON dataset (D18E.3) — the order inverts from the
 * delimited path's: the engine only sees `attachmentsDir`/`tempDir`
 * (`enable_external_access = false`, D18A.3), so the schema can only be
 * asked for *after* the file is copied there. `lines` is drained only to
 * feed `digest()` — no parsing happens here, that's `read_json_auto`'s job
 * once `runSchema` runs.
 *
 * @param runSchema - Asks the DuckDB worker to describe the attached view;
 *   rejects with the engine's own text when a column holds a nested or
 *   inconsistent-schema value (D18E.4) — extracted here into a `blocked`
 *   `Result`, same shape as a scanned PDF with no text layer.
 */
export async function attachJsonDataset(
  { path, jobId }: { path: string; jobId: JobId },
  createHashedLines: (path: string) => { lines: AsyncIterable<string>; digest: () => string },
  attachmentsDir: string,
  storeAttachment: (dir: string, hash: string, sourcePath: string) => Promise<void>,
  runSchema: (hash: string) => Promise<{ columns: string[]; rowCount: number }>,
  emitProgress: (event: JobEvent) => void
): Promise<Result<DatasetPart>> {
  const controller = jobs.create(jobId)
  let lastEmitAt = 0

  const onProgress = (lines: number): void => {
    const now = Date.now()
    if (now - lastEmitAt < PROGRESS_INTERVAL_MS) return
    lastEmitAt = now
    emitProgress({ jobId, type: 'progress', phase: 'scanning', done: lines, total: null })
  }

  try {
    const { lines, digest } = createHashedLines(path)
    const iterator = lines[Symbol.asyncIterator]()
    let lineCount = 0
    for (let step = await iterator.next(); !step.done; step = await iterator.next()) {
      if (controller.signal.aborted) return err({ kind: 'cancelled' })
      lineCount++
      onProgress(lineCount)
    }

    const hash = digest()
    await storeAttachment(attachmentsDir, hash, path)

    try {
      const schema = await runSchema(hash)
      return ok({
        kind: 'dataset',
        hash,
        fileName: basename(path),
        format: 'json',
        columns: schema.columns,
        rowCount: schema.rowCount
      })
    } catch (schemaError) {
      return err({ kind: 'blocked', reason: (schemaError as Error).message })
    }
  } catch (error) {
    return err(mapFsError(error, path))
  } finally {
    jobs.finish(jobId)
  }
}
