import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DuckDBInstance } from '@duckdb/node-api'
import { buildDuckDbStartupCommands } from '@core/duckdb/config'
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

// The three tests above use a bare :memory: instance — none of them would
// have caught the Permission Error a locked-down worker hits for real
// (extension_directory left at its OS default, outside allowed_directories).
describe('engine info SQL under the real worker startup sequence', () => {
  it('lists extensions without a Permission Error once external access is off', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'crivo-engine-info-'))
    try {
      const instance = await DuckDBInstance.create(':memory:')
      const connection = await instance.connect()
      for (const sql of buildDuckDbStartupCommands({
        extensionPaths: [],
        allowedDirectories: [tempDir],
        memoryLimit: '512MB',
        tempDirectory: tempDir
      })) {
        await connection.run(sql)
      }

      const reader = await connection.runAndReadAll(buildExtensionsSql())
      expect(Array.isArray(reader.getRowObjectsJS())).toBe(true)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
