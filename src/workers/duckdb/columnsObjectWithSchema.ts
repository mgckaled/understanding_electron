import type { DuckDBResultReader } from '@duckdb/node-api'

/**
 * `reader.getColumnsObject()` returns `{}` — no keys at all, not empty
 * arrays — once the result has zero rows (confirmed live against the real
 * binding, ago/2026): a query or transform that filters out every row would
 * otherwise serialize to an Arrow table with NO COLUMNS, which the renderer
 * draws as a blank box with no headers, indistinguishable from nothing
 * having run at all. `columnNames()` carries the schema independently of how
 * many rows came back.
 */
export function columnsObjectWithSchema(reader: DuckDBResultReader): Record<string, unknown[]> {
  const raw = reader.getColumnsObject()
  const columns: Record<string, unknown[]> = {}
  for (const name of reader.columnNames()) {
    columns[name] = raw[name] ?? []
  }
  return columns
}
