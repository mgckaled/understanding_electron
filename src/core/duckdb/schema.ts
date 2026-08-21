import { sqlIdentifier } from './profile'

export function buildDescribeSql(viewName: string): string {
  return `DESCRIBE SELECT * FROM "${sqlIdentifier(viewName)}"`
}

// Matches DuckDB's own DESCRIBE type strings for a nested column (D18E.4,
// confirmed against Context7 `duckdb-web`): STRUCT(...), MAP(...), and a
// LIST rendered as a trailing `[]` on the element type — never a value the
// engine would reject on its own (`read_json_auto` infers STRUCT/MAP/LIST
// happily), so this is the only thing standing between a nested column and
// a `DatasetPart` no downstream cell renderer knows how to draw.
const NESTED_TYPE_PATTERN = /^(STRUCT|MAP)\(|\[\]$/

export function hasNestedType(columnType: string): boolean {
  return NESTED_TYPE_PATTERN.test(columnType)
}
