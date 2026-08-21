import { basename } from 'node:path'
import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import type { ColumnProfile, DatasetPart, DatasetRef, JobEvent, JobId, Result } from '@shared/ipc'
import { ok, err } from '@core/result'
import { scanDelimited } from '@core/dataset/scan'
import { mapFsError } from '@core/fsError'
import { isValidHash, isReadOnlyQuery, buildFinalSql } from '@core/duckdb/query'
import * as jobs from '../../jobs'

const PROGRESS_INTERVAL_MS = 100

// The N+1 truncation trick (D18B.4): 201 rows back means there were more,
// and the UI drops the last one. 200 matches the app-wide DOM row cap.
const QUERY_ROW_LIMIT = 201

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

/**
 * Runs a read-only query against an attached dataset (D18B.6). Rejects a
 * malformed hash or a non-read-only `sql` before ever calling `runQuery` —
 * the hash check here only saves a round-trip (format, not path safety);
 * `buildViewSqlInterpolated` enforces the same check again where the path
 * is actually built, in the worker.
 *
 * @param runQuery - Sends `(hash, sql)` to the DuckDB worker and resolves
 *   with Arrow IPC bytes; rejects with the engine's own error text.
 */
export async function queryDataset(
  { hash, sql }: { hash: string; sql: string },
  runQuery: (hash: string, sql: string) => Promise<Uint8Array>
): Promise<Result<Uint8Array>> {
  if (!isValidHash(hash)) {
    return err({ kind: 'invalidQuery', message: 'Identificador de anexo inválido.' })
  }
  if (!isReadOnlyQuery(sql)) {
    return err({
      kind: 'invalidQuery',
      message: 'Apenas consultas de leitura (SELECT/WITH) são permitidas.'
    })
  }

  try {
    const bytes = await runQuery(hash, buildFinalSql(sql, QUERY_ROW_LIMIT))
    return ok(bytes)
  } catch (error) {
    return err({ kind: 'invalidQuery', message: (error as Error).message })
  }
}

/**
 * Computes the level-2 profile for an attached dataset (D18D.2). Same hash
 * guard as `queryDataset`, ahead of the same real check in the worker.
 *
 * @param runProfile - Sends `hash` to the DuckDB worker and resolves with
 *   one entry per column; rejects with the engine's own error text.
 */
export async function profileDataset(
  { hash }: { hash: string },
  runProfile: (hash: string) => Promise<ColumnProfile[]>
): Promise<Result<ColumnProfile[]>> {
  if (!isValidHash(hash)) {
    return err({ kind: 'invalidQuery', message: 'Identificador de anexo inválido.' })
  }

  try {
    const profile = await runProfile(hash)
    return ok(profile)
  } catch (error) {
    return err({ kind: 'invalidQuery', message: (error as Error).message })
  }
}
