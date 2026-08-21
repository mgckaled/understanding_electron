import { join } from 'node:path'
import { DuckDBInstance } from '@duckdb/node-api'
import { buildDuckDbStartupCommands, DUCKDB_MEMORY_LIMIT } from '@core/duckdb/config'
import { ensureDatasetView } from '@core/duckdb/query'
import { columnsToArrowBytes } from '@core/duckdb/arrow'
import {
  buildSummarizeSql,
  buildMaterializeSql,
  buildDropScratchSql,
  buildCountSql,
  buildTopValuesSql,
  qualifiesForTopValues,
  type ColumnProfile
} from '@core/duckdb/profile'
import type { WorkerRequest, WorkerResponse } from '@core/duckdb/protocol'
import { normalizeColumns } from './normalizeColumns'

const userDataPath = process.argv[2]
const attachmentsDir = join(userDataPath, 'attachments')
const tempDir = join(userDataPath, 'duckdb-tmp')

// Never accumulates across requests (D18D.2/D18D.3): CREATE OR REPLACE at
// the start of every profile, DROP in a finally at the end, so a profile
// request for one hash never sees another hash's leftovers even if a prior
// request threw mid-sequence.
const SCRATCH_TABLE = 'dataset_profile_scratch'

async function main(): Promise<void> {
  const instance = await DuckDBInstance.create(':memory:')
  const connection = await instance.connect()

  for (const sql of buildDuckDbStartupCommands({
    extensionPaths: [],
    allowedDirectories: [attachmentsDir, tempDir],
    memoryLimit: DUCKDB_MEMORY_LIMIT,
    tempDirectory: tempDir
  })) {
    await connection.run(sql)
  }

  // Live-confirmed in 18-B: `read_csv_auto($1)` rejects a bound parameter —
  // "Binder Error: Unexpected prepared parameter. This type of statement
  // can't be prepared!" — so the interpolated form is the only one that
  // works, not a fallback. Retry the bound form if issue duckdb-node-neo#45
  // ever closes (ROADMAP § 2).
  //
  // No startup message here — a survivor would resolve the first real query
  // instead of it, since the correlation-free protocol resolves on the next
  // 'message'. main-side createDuckdbWorkerClient serializes every request
  // (both kinds, D18D.1) on one tail promise for this same reason: two
  // concurrent messages would interleave across these `await`s — silently
  // wrong, not an error.

  // Content-addressed, so a hash's encoding never changes once classified —
  // shared between the query and profile paths (D18D.3): a hash already
  // classified latin-1 by a query must not be re-classified, or worse
  // silently mis-profiled, by a hand-rolled view statement of its own.
  const encodingByHash = new Map<string, 'latin-1'>()

  async function ensureView(hash: string): Promise<void> {
    const encoding = await ensureDatasetView({
      hash,
      attachmentsDir,
      knownEncoding: encodingByHash.get(hash),
      run: (viewSql) => connection.run(viewSql)
    })
    if (encoding) encodingByHash.set(hash, encoding)
  }

  async function handleQuery(hash: string, sql: string): Promise<WorkerResponse> {
    try {
      await ensureView(hash)
      const reader = await connection.runAndReadAll(sql)
      const bytes = columnsToArrowBytes(normalizeColumns(reader.getColumnsObject()))
      return { kind: 'query', ok: true, bytes }
    } catch (error) {
      return { kind: 'query', ok: false, message: (error as Error).message }
    }
  }

  // SUMMARIZE's own min/max/avg columns are cast to VARCHAR by the engine
  // (uniform typing across a table's heterogeneous columns) — read as
  // strings and parsed here, not received already numeric.
  async function profileScratchTable(): Promise<ColumnProfile[]> {
    const countReader = await connection.runAndReadAll(buildCountSql(SCRATCH_TABLE))
    const [countRow] = countReader.getRowObjectsJS() as [{ row_count: bigint | number }]
    const rowCount = Number(countRow.row_count)

    const summaryReader = await connection.runAndReadAll(buildSummarizeSql(SCRATCH_TABLE))
    const summaryRows = summaryReader.getRowObjectsJS() as Record<string, unknown>[]

    const profile: ColumnProfile[] = []
    for (const row of summaryRows) {
      const approxUnique = Number(row.approx_unique)
      const entry: ColumnProfile = {
        column: String(row.column_name),
        type: String(row.column_type),
        nullPercentage: Number(row.null_percentage),
        approxUnique,
        min: row.min === null || row.min === undefined ? null : String(row.min),
        max: row.max === null || row.max === undefined ? null : String(row.max),
        avg: row.avg === null || row.avg === undefined ? null : Number(row.avg)
      }
      if (qualifiesForTopValues(approxUnique, rowCount)) {
        const topReader = await connection.runAndReadAll(
          buildTopValuesSql(SCRATCH_TABLE, entry.column)
        )
        entry.topValues = topReader.getRowObjectsJS().map((topRow) => {
          const typed = topRow as { value: unknown; count: unknown }
          return { value: String(typed.value), count: Number(typed.count) }
        })
      }
      profile.push(entry)
    }
    return profile
  }

  async function handleProfile(hash: string): Promise<WorkerResponse> {
    try {
      await ensureView(hash)
      await connection.run(buildMaterializeSql('dataset', SCRATCH_TABLE))
      try {
        const profile = await profileScratchTable()
        return { kind: 'profile', ok: true, profile }
      } finally {
        await connection.run(buildDropScratchSql(SCRATCH_TABLE))
      }
    } catch (error) {
      return { kind: 'profile', ok: false, message: (error as Error).message }
    }
  }

  function handleRequest(request: WorkerRequest): Promise<WorkerResponse> {
    switch (request.kind) {
      case 'query':
        return handleQuery(request.hash, request.sql)
      case 'profile':
        return handleProfile(request.hash)
    }
  }

  process.parentPort.on('message', async (e: { data: WorkerRequest }) => {
    const response = await handleRequest(e.data)
    process.parentPort.postMessage(response)
  })
}

void main()
