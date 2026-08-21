import { DuckDBDateValue, DuckDBTimestampValue, DuckDBTimestampTZValue } from '@duckdb/node-api'

const MS_PER_DAY = 86_400_000
const MICROS_PER_MS = 1_000n

// DATE (D18B) and TIMESTAMP (D18E.6, an ISO datetime string) are the two
// column types confirmed to come back from getColumnsObject() wrapped in
// their own class rather than a plain JS value — every other type the CSV
// and JSON sniffers produce already arrives as bigint/number/string/boolean/
// null. DuckDBTimestampTZValue shares DuckDBTimestampValue's micros-since-
// epoch shape, so the same conversion covers both.
function normalizeValue(value: unknown): unknown {
  if (value instanceof DuckDBDateValue) return new Date(value.days * MS_PER_DAY)
  if (value instanceof DuckDBTimestampValue || value instanceof DuckDBTimestampTZValue) {
    return new Date(Number(value.micros / MICROS_PER_MS))
  }
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
