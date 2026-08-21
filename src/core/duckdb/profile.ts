// ColumnProfile is the IPC contract's result type (shared/ipc.ts owns it,
// D18D.4) — core/ imports from shared/, never the other way.
export type { ColumnProfile } from '@shared/ipc'

/**
 * Escapes a DuckDB identifier for double-quoted interpolation — same
 * approach as `sqlPath` (D18A.3), applied to a column name instead of a
 * filesystem path.
 */
export function sqlIdentifier(name: string): string {
  return name.replace(/"/g, '""')
}

export function buildSummarizeSql(viewName: string): string {
  return `SUMMARIZE "${sqlIdentifier(viewName)}"`
}

/**
 * One read of the source view into a temp table (D18D.2) — `SUMMARIZE` and
 * each top-N `GROUP BY` below would otherwise re-scan the CSV behind the
 * view once per statement.
 */
export function buildMaterializeSql(viewName: string, scratchTable: string): string {
  return `CREATE OR REPLACE TEMP TABLE "${sqlIdentifier(scratchTable)}" AS SELECT * FROM "${sqlIdentifier(viewName)}"`
}

export function buildDropScratchSql(scratchTable: string): string {
  return `DROP TABLE IF EXISTS "${sqlIdentifier(scratchTable)}"`
}

export function buildCountSql(scratchTable: string): string {
  return `SELECT COUNT(*) AS row_count FROM "${sqlIdentifier(scratchTable)}"`
}

/**
 * Top-N is only useful below a cardinality ceiling — reasoned from
 * ESCOPO.md's own example (`cpf`'s five most frequent values are a leak, not
 * a statistic), not measured. `rowCount === 0` never qualifies: the ratio
 * term would divide by zero.
 */
export function qualifiesForTopValues(approxUnique: number, rowCount: number): boolean {
  if (rowCount === 0) return false
  return approxUnique <= 50 && approxUnique / rowCount <= 0.5
}

export function buildTopValuesSql(scratchTable: string, column: string, limit = 5): string {
  const table = sqlIdentifier(scratchTable)
  const col = sqlIdentifier(column)
  return `SELECT "${col}" AS value, COUNT(*) AS count FROM "${table}" GROUP BY "${col}" ORDER BY count DESC LIMIT ${limit}`
}
