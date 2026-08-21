import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import type { DatasetFormat } from '@core/dataset/format'
import type { ColumnProfile, DatasetPart, DatasetRef, JobEvent, JobId, Result } from '@shared/ipc'
import { ok, err } from '@core/result'
import { isValidHash, isReadOnlyQuery, buildFinalSql } from '@core/duckdb/query'
import { attachJsonDataset } from './attachJson'
import { attachDelimitedDataset } from './attachDelimited'
import { attachExcelDataset } from './attachExcel'

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
    // The OS dialog shows only the FIRST filter's extensions by default — a
    // second filter is a dropdown the user has to notice and switch, not an
    // OR. A combined filter listed first is what makes both formats visible
    // without that extra step (bug found live: JSON/NDJSON were invisible
    // until the user manually picked the second filter).
    filters: [
      {
        name: 'Dados tabulares',
        extensions: ['csv', 'tsv', 'txt', 'json', 'ndjson', 'jsonl', 'xlsx']
      },
      { name: 'Delimited text', extensions: ['csv', 'tsv', 'txt'] },
      { name: 'JSON', extensions: ['json', 'ndjson', 'jsonl'] },
      { name: 'Excel', extensions: ['xlsx'] }
    ]
  })

  if (canceled || filePaths.length === 0) return ok(null)
  return ok({ path: filePaths[0] })
}

/**
 * Attaches a dataset, dispatching on `sniffFormat` of the original file
 * (D18E.1/D18E.3) — delimited, JSON and Excel take different orders (the
 * latter two copy to `attachmentsDir` before they can ask the engine for a
 * schema, D18A.3), so each lives in its own module: {@link
 * attachDelimitedDataset}, {@link attachJsonDataset}, {@link
 * attachExcelDataset}.
 *
 * `storage` groups `attachmentsDir`/`storeAttachment` into one parameter —
 * adding `createHashOnlyFile` for the Excel path would have pushed this
 * signature to 8 injected dependencies (D18F, decided in passo 3).
 */
export async function attachDataset(
  args: { path: string; jobId: JobId },
  createHashedLines: (path: string) => { lines: AsyncIterable<string>; digest: () => string },
  createHashOnlyFile: (path: string) => {
    run: (signal: AbortSignal) => Promise<void>
    digest: () => string
  },
  storage: {
    attachmentsDir: string
    storeAttachment: (dir: string, hash: string, sourcePath: string) => Promise<void>
  },
  emitProgress: (event: JobEvent) => void,
  sniffFormat: (path: string) => Promise<DatasetFormat>,
  runSchema: (hash: string) => Promise<{ columns: string[]; rowCount: number }>
): Promise<Result<DatasetPart>> {
  const format = await sniffFormat(args.path)
  const { attachmentsDir, storeAttachment } = storage

  if (format === 'json') {
    return attachJsonDataset(
      args,
      createHashedLines,
      attachmentsDir,
      storeAttachment,
      runSchema,
      emitProgress
    )
  }
  if (format === 'excel') {
    return attachExcelDataset(
      args,
      createHashOnlyFile,
      attachmentsDir,
      storeAttachment,
      runSchema,
      emitProgress
    )
  }
  return attachDelimitedDataset(
    args,
    createHashedLines,
    attachmentsDir,
    storeAttachment,
    emitProgress
  )
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
