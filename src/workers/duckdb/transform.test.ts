import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api'
import { ensureDatasetView } from '@core/duckdb/query'
import {
  buildMaterializeSql,
  buildMaterializeQuerySql,
  buildDropScratchSql,
  buildSummarizeSql
} from '@core/duckdb/profile'
import { compileSteps } from '@core/pipeline/compile'
import type { Step } from '@shared/ipc'

// A real 64-char hex digest — attachments live at `attachmentsDir/<hash>`,
// no extension (D16.3).
const HASH = 'b'.repeat(64)
const SCRATCH = 'transform_test_scratch'

async function withAttachedCsv(
  content: string,
  run: (connection: DuckDBConnection) => Promise<void>
): Promise<void> {
  const attachmentsDir = await mkdtemp(join(tmpdir(), 'crivo-transform-'))
  try {
    await writeFile(join(attachmentsDir, HASH), content, 'utf8')
    const instance = await DuckDBInstance.create(':memory:')
    const connection = await instance.connect()

    await ensureDatasetView({
      hash: HASH,
      attachmentsDir,
      format: 'delimited',
      knownEncoding: undefined,
      run: (sql) => connection.run(sql)
    })

    await run(connection)
  } finally {
    await rm(attachmentsDir, { recursive: true, force: true })
  }
}

async function summarize(
  connection: DuckDBConnection
): Promise<Record<string, { nullPercentage: number }>> {
  const reader = await connection.runAndReadAll(buildSummarizeSql(SCRATCH))
  const rows = reader.getRowObjectsJS() as { column_name: unknown; null_percentage: unknown }[]
  return Object.fromEntries(
    rows.map((row) => [String(row.column_name), { nullPercentage: Number(row.null_percentage) }])
  )
}

// Exercises compileSteps' EXCLUDE/RENAME/REPLACE SQL (D19.1 passo 2) against
// the real engine — compile.test.ts only checks the generated string, never
// that DuckDB accepts it.
describe('compiled steps against a real DuckDB engine (D19.4)', () => {
  it('fillMissing zeroes the null percentage the before-profile reported', async () => {
    const csv = 'idade,nome\n18,Ana\n,Bruno\n,Carla\n40,Denis\n'

    await withAttachedCsv(csv, async (connection) => {
      await connection.run(buildMaterializeSql('dataset', SCRATCH))
      const before = await summarize(connection)
      expect(before.idade.nullPercentage).toBeGreaterThan(0)
      await connection.run(buildDropScratchSql(SCRATCH))

      const steps: Step[] = [{ kind: 'fillMissing', column: 'idade', strategy: 'zero' }]
      const sql = compileSteps(steps, ['idade', 'nome'])
      await connection.run(buildMaterializeQuerySql(sql, SCRATCH))
      const after = await summarize(connection)
      expect(after.idade.nullPercentage).toBe(0)
      await connection.run(buildDropScratchSql(SCRATCH))
    })
  })

  it('dropColumns removes the column from the summarized result', async () => {
    const csv = 'idade,email\n18,ana@x.com\n40,\n'

    await withAttachedCsv(csv, async (connection) => {
      const steps: Step[] = [{ kind: 'dropColumns', columns: ['email'] }]
      const sql = compileSteps(steps, ['idade', 'email'])
      await connection.run(buildMaterializeQuerySql(sql, SCRATCH))
      const after = await summarize(connection)
      expect(after.email).toBeUndefined()
      expect(after.idade).toBeDefined()
      await connection.run(buildDropScratchSql(SCRATCH))
    })
  })

  it('renameColumn surfaces the transformed data under the new name', async () => {
    const csv = 'cidade\nSao Paulo\nRecife\n'

    await withAttachedCsv(csv, async (connection) => {
      const steps: Step[] = [{ kind: 'renameColumn', from: 'cidade', to: 'municipio' }]
      const sql = compileSteps(steps, ['cidade'])
      await connection.run(buildMaterializeQuerySql(sql, SCRATCH))
      const after = await summarize(connection)
      expect(after.municipio).toBeDefined()
      expect(after.cidade).toBeUndefined()
      await connection.run(buildDropScratchSql(SCRATCH))
    })
  })

  it('chains filter, sort and limit into one materialized result', async () => {
    const csv = 'idade,nome\n18,Ana\n40,Bruno\n65,Carla\n70,Denis\n'

    await withAttachedCsv(csv, async (connection) => {
      const steps: Step[] = [
        { kind: 'filter', column: 'idade', operator: 'gte', value: 40 },
        { kind: 'sort', column: 'idade', direction: 'desc' },
        { kind: 'limit', count: 2 }
      ]
      const sql = compileSteps(steps, ['idade', 'nome'])
      const reader = await connection.runAndReadAll(sql)
      const rows = reader.getRowObjectsJS() as { idade: unknown; nome: unknown }[]
      expect(rows.map((row) => Number(row.idade))).toEqual([70, 65])
    })
  })
})
