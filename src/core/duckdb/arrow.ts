import { tableFromArrays, tableToIPC } from 'apache-arrow'

/**
 * Builds an Arrow `Table` from the column-oriented shape
 * `reader.getColumnsObject()` produces and serializes it to IPC bytes
 * (D18B.1) — `@duckdb/node-api` does not export Arrow natively (issue
 * duckdb-node-neo#45), so this is where that conversion actually happens.
 */
export function columnsToArrowBytes(columns: Record<string, unknown[]>): Uint8Array {
  const table = tableFromArrays(columns)
  return tableToIPC(table)
}
