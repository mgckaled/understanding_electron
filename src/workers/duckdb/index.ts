import { join } from 'node:path'
import { DuckDBInstance } from '@duckdb/node-api'
import { buildDuckDbStartupCommands, DUCKDB_MEMORY_LIMIT } from '@core/duckdb/config'
import { buildViewSqlInterpolated } from '@core/duckdb/query'
import { columnsToArrowBytes } from '@core/duckdb/arrow'
import type { WorkerQueryRequest, WorkerQueryResponse } from '@core/duckdb/protocol'
import { normalizeColumns } from './normalizeColumns'

const userDataPath = process.argv[2]
const attachmentsDir = join(userDataPath, 'attachments')
const tempDir = join(userDataPath, 'duckdb-tmp')

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
  // can't be prepared!" — so the interpolated form is not a fallback here,
  // it is the only form that works. buildViewSqlParameterized stays exported
  // from core/duckdb/query.ts in case a future @duckdb/node-api version
  // changes this (ROADMAP § 2).
  process.parentPort.on('message', async (e: { data: WorkerQueryRequest }) => {
    const { hash, sql } = e.data
    try {
      await connection.run(buildViewSqlInterpolated(hash, attachmentsDir))
      const reader = await connection.runAndReadAll(sql)
      const bytes = columnsToArrowBytes(normalizeColumns(reader.getColumnsObject()))
      const response: WorkerQueryResponse = { ok: true, bytes }
      process.parentPort.postMessage(response)
    } catch (error) {
      const response: WorkerQueryResponse = { ok: false, message: (error as Error).message }
      process.parentPort.postMessage(response)
    }
  })
}

void main()
