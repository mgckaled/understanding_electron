import { DuckDBDateValue, DuckDBTimestampValue, DuckDBTimestampTZValue } from '@duckdb/node-api'
import { normalizeColumns } from './normalizeColumns'

describe('normalizeColumns', () => {
  it('unwraps a DuckDBDateValue into a Date at UTC midnight', () => {
    // 19889 days since epoch is 2024-06-15 (confirmed via Date.UTC / 86400000).
    const days = Date.UTC(2024, 5, 15) / 86_400_000
    const result = normalizeColumns({ createdAt: [new DuckDBDateValue(days)] })

    expect(result.createdAt[0]).toEqual(new Date(Date.UTC(2024, 5, 15)))
  })

  // The wrapper a JSON attach's ISO datetime column comes back as (D18E.6),
  // confirmed live against the real engine — read_json_auto('...criado_em":
  // "2026-08-21T10:30:00"...') hands getColumnsObject() a DuckDBTimestampValue,
  // not a plain value, same class of gap DuckDBDateValue closed for 18-B.
  it('unwraps a DuckDBTimestampValue into a Date at the same instant', () => {
    const instant = Date.UTC(2026, 7, 21, 10, 30, 0)
    const result = normalizeColumns({
      createdAt: [new DuckDBTimestampValue(BigInt(instant) * 1_000n)]
    })

    expect(result.createdAt[0]).toEqual(new Date(instant))
  })

  it('unwraps a DuckDBTimestampTZValue the same way', () => {
    const instant = Date.UTC(2026, 7, 21, 10, 30, 0)
    const result = normalizeColumns({
      createdAt: [new DuckDBTimestampTZValue(BigInt(instant) * 1_000n)]
    })

    expect(result.createdAt[0]).toEqual(new Date(instant))
  })

  it('leaves already-plain values untouched', () => {
    const result = normalizeColumns({
      id: [1n, 2n],
      price: [1.5, null],
      name: ['Ana', null],
      active: [true, false]
    })

    expect(result).toEqual({
      id: [1n, 2n],
      price: [1.5, null],
      name: ['Ana', null],
      active: [true, false]
    })
  })

  it('preserves column order and row count across multiple columns', () => {
    const days = Date.UTC(2024, 0, 1) / 86_400_000
    const result = normalizeColumns({
      id: [1n],
      createdAt: [new DuckDBDateValue(days)]
    })

    expect(Object.keys(result)).toEqual(['id', 'createdAt'])
    expect(result.createdAt).toHaveLength(1)
  })
})
