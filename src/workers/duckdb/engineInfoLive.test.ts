import { DuckDBInstance } from '@duckdb/node-api'
import {
  buildMemoryLimitSql,
  buildExtensionsSql,
  buildMemoryByTagSql
} from '@core/duckdb/engineInfo'

// Confirms the column names core/duckdb/engineInfo.ts's SQL depends on
// actually exist on the @duckdb/node-api version installed here — the
// plan's own warning (O-3 passo 1) that the doc's column names can drift
// between engine versions.
describe('engine info SQL against the real, installed DuckDB engine', () => {
  it('memory_limit reads as a display string', async () => {
    const instance = await DuckDBInstance.create(':memory:')
    const connection = await instance.connect()
    const reader = await connection.runAndReadAll(buildMemoryLimitSql())
    const [row] = reader.getRowObjectsJS() as [{ value: string }]
    expect(typeof row.value).toBe('string')
  })

  it('extensions carry name, loaded, installed and version', async () => {
    const instance = await DuckDBInstance.create(':memory:')
    const connection = await instance.connect()
    const reader = await connection.runAndReadAll(buildExtensionsSql())
    const rows = reader.getRowObjectsJS() as Record<string, unknown>[]
    for (const row of rows) {
      expect(row).toHaveProperty('extension_name')
      expect(row).toHaveProperty('loaded')
      expect(row).toHaveProperty('installed')
      expect(row).toHaveProperty('extension_version')
    }
  })

  it('memory-by-tag runs without error on a fresh instance', async () => {
    const instance = await DuckDBInstance.create(':memory:')
    const connection = await instance.connect()
    const reader = await connection.runAndReadAll(buildMemoryByTagSql())
    expect(Array.isArray(reader.getRowObjectsJS())).toBe(true)
  })
})
