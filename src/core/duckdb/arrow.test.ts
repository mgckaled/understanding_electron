import { tableFromIPC } from 'apache-arrow'
import { columnsToArrowBytes } from './arrow'

// Reads a column back the way any real consumer must (D18B.1 finding): a
// vector's own `.toArray()` returns the raw typed array and silently turns
// null slots into 0 — only iterating the vector consults the validity
// bitmap. Both the round-trip test below and DatasetQueryPanel rely on this.
function readColumn(bytes: Uint8Array, name: string): unknown[] {
  const table = tableFromIPC(bytes)
  const vector = table.getChild(name)
  if (!vector) throw new Error(`missing column: ${name}`)
  return [...vector]
}

describe('columnsToArrowBytes', () => {
  // The six types the CSV sniffer produces (D18B § passo 2 aceite).
  it('round-trips BIGINT', () => {
    const bytes = columnsToArrowBytes({ id: [1n, 2n, 3n] })
    expect(readColumn(bytes, 'id')).toEqual([1n, 2n, 3n])
  })

  it('round-trips DOUBLE', () => {
    const bytes = columnsToArrowBytes({ price: [1.5, -2.25, 0] })
    expect(readColumn(bytes, 'price')).toEqual([1.5, -2.25, 0])
  })

  it('round-trips VARCHAR', () => {
    const bytes = columnsToArrowBytes({ name: ['Ana', 'Bruno'] })
    expect(readColumn(bytes, 'name')).toEqual(['Ana', 'Bruno'])
  })

  // DATE arrives here already normalized to `Date` by
  // workers/duckdb/normalizeColumns.ts, never as DuckDB's own DuckDBDateValue
  // wrapper — this module stays generic (D18B advisor review). Arrow infers
  // Timestamp<MILLISECOND> from a Date and gives back a plain millis number
  // on read, not a Date instance — a real, expected transformation, not a
  // round-trip defect.
  it('round-trips DATE as millis-since-epoch', () => {
    const date = new Date('2024-06-15T00:00:00.000Z')
    const bytes = columnsToArrowBytes({ createdAt: [date] })
    expect(readColumn(bytes, 'createdAt')).toEqual([date.getTime()])
  })

  it('round-trips BOOLEAN', () => {
    const bytes = columnsToArrowBytes({ active: [true, false] })
    expect(readColumn(bytes, 'active')).toEqual([true, false])
  })

  it('round-trips a column with NULL mixed among values', () => {
    const bytes = columnsToArrowBytes({ score: [10, null, 30] })
    expect(readColumn(bytes, 'score')).toEqual([10, null, 30])
  })

  // Two edge cases flagged in review: neither has a non-null value to infer
  // a type from, and both are reachable from the plain "SELECT ..." UI.
  it('does not throw on an empty result set', () => {
    const bytes = columnsToArrowBytes({ id: [] })
    expect(readColumn(bytes, 'id')).toEqual([])
  })

  it('does not throw on an entirely NULL column', () => {
    const bytes = columnsToArrowBytes({ note: [null, null] })
    expect(readColumn(bytes, 'note')).toEqual([null, null])
  })

  it('round-trips multiple columns together, preserving row order', () => {
    const bytes = columnsToArrowBytes({
      id: [1n, 2n],
      name: ['Ana', 'Bruno']
    })

    expect(readColumn(bytes, 'id')).toEqual([1n, 2n])
    expect(readColumn(bytes, 'name')).toEqual(['Ana', 'Bruno'])
  })
})
