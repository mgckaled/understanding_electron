import { DuckDBDateValue } from '@duckdb/node-api'

const MS_PER_DAY = 86_400_000

// Of the six types the CSV sniffer produces (D18B § passo 2), only DATE
// comes back from getColumnsObject() wrapped — BIGINT, DOUBLE, VARCHAR,
// BOOLEAN and NULL already arrive as plain JS bigint/number/string/boolean/
// null (confirmed against the @duckdb/node-api README's value table).
function normalizeValue(value: unknown): unknown {
  if (value instanceof DuckDBDateValue) return new Date(value.days * MS_PER_DAY)
  return value
}

/**
 * Converts DuckDB's own value wrappers into the plain JS values
 * `core/duckdb/arrow.ts` expects — kept in `workers/`, not `core/`, because
 * only this layer already depends on `@duckdb/node-api` and knows its
 * wrapper shapes (D18B advisor review).
 */
export function normalizeColumns(columns: Record<string, unknown[]>): Record<string, unknown[]> {
  const normalized: Record<string, unknown[]> = {}
  for (const [name, values] of Object.entries(columns)) {
    normalized[name] = values.map(normalizeValue)
  }
  return normalized
}
