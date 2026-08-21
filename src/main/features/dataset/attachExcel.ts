import { basename } from 'node:path'
import type { DatasetPart, JobEvent, JobId, Result } from '@shared/ipc'
import { ok, err } from '@core/result'
import { mapFsError } from '@core/fsError'
import * as jobs from '../../jobs'

/**
 * Attaches an `.xlsx` dataset (D18F.4) — hash → store → ask the engine for a
 * schema, the same order {@link attachJsonDataset} uses and for the same
 * reason (D18A.3): the engine only ever sees `attachmentsDir`, never the
 * user's original path. Unlike the delimited and JSON paths, there is no
 * line-shaped product to report progress against, so `emitProgress` fires
 * once, at the start, for an indeterminate spinner rather than a counted one.
 *
 * @param createHashOnlyFile - Builds the stream+hash pair for `path`
 *   ({@link hashOnlyFile}) — injected so this stays testable without a real
 *   file.
 * @param runSchema - Asks the DuckDB worker to describe the attached view;
 *   rejects with the engine's own text when a column holds a nested or
 *   inconsistent-schema value — extracted here into a `blocked` `Result`,
 *   same shape as the JSON and PDF-with-no-text-layer paths.
 */
export async function attachExcelDataset(
  { path, jobId }: { path: string; jobId: JobId },
  createHashOnlyFile: (path: string) => {
    run: (signal: AbortSignal) => Promise<void>
    digest: () => string
  },
  attachmentsDir: string,
  storeAttachment: (dir: string, hash: string, sourcePath: string) => Promise<void>,
  runSchema: (hash: string) => Promise<{ columns: string[]; rowCount: number }>,
  emitProgress: (event: JobEvent) => void
): Promise<Result<DatasetPart>> {
  const controller = jobs.create(jobId)

  try {
    emitProgress({ jobId, type: 'progress', phase: 'scanning', done: 0, total: null })

    const { run, digest } = createHashOnlyFile(path)
    await run(controller.signal)
    if (controller.signal.aborted) return err({ kind: 'cancelled' })

    const hash = digest()
    await storeAttachment(attachmentsDir, hash, path)

    try {
      const schema = await runSchema(hash)
      return ok({
        kind: 'dataset',
        hash,
        fileName: basename(path),
        format: 'excel',
        columns: schema.columns,
        rowCount: schema.rowCount
      })
    } catch (schemaError) {
      return err({ kind: 'blocked', reason: (schemaError as Error).message })
    }
  } catch (error) {
    if (controller.signal.aborted) return err({ kind: 'cancelled' })
    return err(mapFsError(error, path))
  } finally {
    jobs.finish(jobId)
  }
}
