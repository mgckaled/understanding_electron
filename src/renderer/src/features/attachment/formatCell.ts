// Extracted at the third consumer (D19.6). A plain .ts module, not folded
// into DatasetTable.tsx: react-refresh/only-export-components rejects a .tsx
// exporting anything besides a component.
export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '∅'
  if (typeof value === 'bigint') return value.toString()
  return String(value)
}

/**
 * Which columns hold numbers, read from the rows rather than from a schema.
 *
 * The three tables that render this shape reach it by different routes — one
 * has the engine's schema, one has a transform's, one has neither — and the
 * first non-null cell answers for all of them (DF3D.5).
 */
export function numericColumns(columnCount: number, rows: unknown[][]): boolean[] {
  return Array.from({ length: columnCount }, (_, index) => {
    const cell = rows.find((row) => row[index] !== null && row[index] !== undefined)?.[index]
    return typeof cell === 'number' || typeof cell === 'bigint'
  })
}
