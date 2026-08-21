import { sqlIdentifier } from './profile'

export function buildDescribeSql(viewName: string): string {
  return `DESCRIBE SELECT * FROM "${sqlIdentifier(viewName)}"`
}

// DuckDB's own DESCRIBE type strings for a nested or inconsistent column
// (D18E.4): STRUCT(...), MAP(...), a trailing `[]` for LIST, and the exact
// type JSON — the engine's own fallback when a field's type varies row to
// row (verified live: none of these are errors read_json_auto raises).
const NESTED_TYPE_PATTERN = /^(STRUCT|MAP)\(|\[\]$|^JSON$/

export function hasNestedType(columnType: string): boolean {
  return NESTED_TYPE_PATTERN.test(columnType)
}
