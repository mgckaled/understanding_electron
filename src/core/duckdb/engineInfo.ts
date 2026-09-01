export function buildMemoryLimitSql(): string {
  return "SELECT value FROM duckdb_settings() WHERE name = 'memory_limit'"
}

export function buildExtensionsSql(): string {
  return 'SELECT extension_name, loaded, installed, extension_version FROM duckdb_extensions() WHERE loaded OR installed'
}

export function buildMemoryByTagSql(): string {
  return 'SELECT tag, memory_usage_bytes FROM duckdb_memory() WHERE memory_usage_bytes > 0 OR temporary_storage_bytes > 0'
}
