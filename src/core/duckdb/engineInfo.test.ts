import { buildMemoryLimitSql, buildExtensionsSql, buildMemoryByTagSql } from './engineInfo'

describe('buildMemoryLimitSql', () => {
  it('reads the applied memory_limit, not a constant', () => {
    expect(buildMemoryLimitSql()).toBe(
      "SELECT value FROM duckdb_settings() WHERE name = 'memory_limit'"
    )
  })
})

describe('buildExtensionsSql', () => {
  it('filters to loaded or installed, never the full binary list', () => {
    expect(buildExtensionsSql()).toBe(
      'SELECT extension_name, loaded, installed, extension_version FROM duckdb_extensions() WHERE loaded OR installed'
    )
  })
})

describe('buildMemoryByTagSql', () => {
  it('filters to tags with real allocation', () => {
    expect(buildMemoryByTagSql()).toBe(
      'SELECT tag, memory_usage_bytes FROM duckdb_memory() WHERE memory_usage_bytes > 0 OR temporary_storage_bytes > 0'
    )
  })
})
