import { open } from 'node:fs/promises'
import { join } from 'node:path'
import { DuckDBInstance } from '@duckdb/node-api'
import { sniffDatasetFormat, type DatasetFormat } from '@core/dataset/format'
import { buildDuckDbStartupCommands, DUCKDB_MEMORY_LIMIT } from '@core/duckdb/config'
import { ensureDatasetView } from '@core/duckdb/query'
import { columnsToArrowBytes } from '@core/duckdb/arrow'
import {
  buildSummarizeSql,
  buildMaterializeSql,
  buildMaterializeQuerySql,
  buildDropScratchSql,
  buildCountSql,
  buildTopValuesSql,
  qualifiesForTopValues,
  type ColumnProfile
} from '@core/duckdb/profile'
import { buildDescribeSql, hasNestedType } from '@core/duckdb/schema'
import type { WorkerRequest, WorkerResponse } from '@core/duckdb/protocol'
import { normalizeColumns } from './normalizeColumns'

// Enough to see past a BOM and any leading whitespace (D18E.1) — never the
// whole file: a 2GB attachment must not be read into JS to answer "is this
// JSON?" (ESCOPO.md § Escala).
const FORMAT_SNIFF_BYTES = 256

async function sniffFileFormat(path: string): Promise<DatasetFormat> {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(FORMAT_SNIFF_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, FORMAT_SNIFF_BYTES, 0)
    return sniffDatasetFormat(buffer.subarray(0, bytesRead))
  } finally {
    await handle.close()
  }
}

const userDataPath = process.argv[2]
const excelExtensionPath = process.argv[3]
const attachmentsDir = join(userDataPath, 'attachments')
const tempDir = join(userDataPath, 'duckdb-tmp')

// Never accumulates across requests (D18D.2/D18D.3): CREATE OR REPLACE at
// the start of every profile, DROP in a finally at the end, so a profile
// request for one hash never sees another hash's leftovers even if a prior
// request threw mid-sequence. Shared with 'transform' (D19.4) — safe because
// createEnqueue (main/duckdb/spawnWorker.ts) serializes every request onto
// one tail promise, so two profiling passes never run at once.
const SCRATCH_TABLE = 'dataset_profile_scratch'

// The DOM row cap (CLAUDE.md § Arquitetura de dados) — dataset:transform's
// before/after profile already reports the true row count, so unlike
// dataset:query's 201-row N+1 trick, no "there is more" signal is needed here.
const TRANSFORM_PREVIEW_ROWS = 200

async function main(): Promise<void> {
  const instance = await DuckDBInstance.create(':memory:')
  const connection = await instance.connect()

  for (const sql of buildDuckDbStartupCommands({
    extensionPaths: [excelExtensionPath],
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

  // Same reasoning as encodingByHash, generalized to format (D18E.1): the
  // same content-addressed hash never changes format, so it is sniffed once
  // — by a query, a profile, or a schema request, whichever sees it first.
  const formatByHash = new Map<string, DatasetFormat>()

  async function resolveFormat(hash: string): Promise<DatasetFormat> {
    const known = formatByHash.get(hash)
    if (known) return known
    const format = await sniffFileFormat(join(attachmentsDir, hash))
    formatByHash.set(hash, format)
    return format
  }

  async function ensureView(hash: string): Promise<void> {
    const format = await resolveFormat(hash)
    const encoding = await ensureDatasetView({
      hash,
      attachmentsDir,
      format,
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
        // DATE/TIMESTAMP's own `avg` is a real DuckDB value, but a datetime
        // string ("2023-11-04 12:00:00") — `Number(...)` on it is NaN, a
        // silent contract violation of `avg: number | null` (bug found live:
        // the renderer's formatNumber has no NaN guard, so it printed "NaN").
        avg: (() => {
          if (row.avg === null || row.avg === undefined) return null
          const parsed = Number(row.avg)
          return Number.isFinite(parsed) ? parsed : null
        })()
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

  /**
   * Runs the compiled steps (D19.1/D19.4): profiles the dataset before and
   * after, then previews the transformed result capped at
   * TRANSFORM_PREVIEW_ROWS. `sql` materializes in full for the after-profile
   * (its true row count and null percentages), and the preview reads back
   * from that same materialized copy instead of re-running `sql` a second
   * time.
   */
  async function handleTransform(hash: string, sql: string): Promise<WorkerResponse> {
    try {
      await ensureView(hash)

      await connection.run(buildMaterializeSql('dataset', SCRATCH_TABLE))
      let before: ColumnProfile[]
      try {
        before = await profileScratchTable()
      } finally {
        await connection.run(buildDropScratchSql(SCRATCH_TABLE))
      }

      await connection.run(buildMaterializeQuerySql(sql, SCRATCH_TABLE))
      try {
        const after = await profileScratchTable()
        const previewReader = await connection.runAndReadAll(
          `SELECT * FROM "${SCRATCH_TABLE}" LIMIT ${TRANSFORM_PREVIEW_ROWS}`
        )
        const bytes = columnsToArrowBytes(normalizeColumns(previewReader.getColumnsObject()))
        return { kind: 'transform', ok: true, bytes, before, after }
      } finally {
        await connection.run(buildDropScratchSql(SCRATCH_TABLE))
      }
    } catch (error) {
      return { kind: 'transform', ok: false, message: (error as Error).message }
    }
  }

  /**
   * Resolves the schema for a JSON attach (D18E.3) — the source of
   * `columns`/`rowCount` is the engine's own `DESCRIBE`, never a hand-rolled
   * parser: writing one would duplicate the inference `read_json_auto`
   * already does. Rejects with `ok: false` on the first nested column found
   * (D18E.4) — `STRUCT`/`MAP`/`LIST` are typed happily by the engine, but no
   * downstream cell renderer knows how to draw one.
   */
  async function handleSchema(hash: string): Promise<WorkerResponse> {
    try {
      await ensureView(hash)
      const describeReader = await connection.runAndReadAll(buildDescribeSql('dataset'))
      const describeRows = describeReader.getRowObjectsJS() as {
        column_name: unknown
        column_type: unknown
      }[]

      for (const row of describeRows) {
        const columnType = String(row.column_type)
        if (hasNestedType(columnType)) {
          return {
            kind: 'schema',
            ok: false,
            message: `A coluna "${String(row.column_name)}" tem um valor aninhado (${columnType}), que este app não trata — achate a coluna antes de anexar.`
          }
        }
      }

      const countReader = await connection.runAndReadAll(buildCountSql('dataset'))
      const [countRow] = countReader.getRowObjectsJS() as [{ row_count: bigint | number }]

      return {
        kind: 'schema',
        ok: true,
        columns: describeRows.map((row) => String(row.column_name)),
        rowCount: Number(countRow.row_count)
      }
    } catch (error) {
      return { kind: 'schema', ok: false, message: (error as Error).message }
    }
  }

  function handleRequest(request: WorkerRequest): Promise<WorkerResponse> {
    switch (request.kind) {
      case 'query':
        return handleQuery(request.hash, request.sql)
      case 'profile':
        return handleProfile(request.hash)
      case 'schema':
        return handleSchema(request.hash)
      case 'transform':
        return handleTransform(request.hash, request.sql)
    }
  }

  process.parentPort.on('message', async (e: { data: WorkerRequest }) => {
    const response = await handleRequest(e.data)
    process.parentPort.postMessage(response)
  })
}

void main()
