import { formatCell, numericColumns } from './formatCell'

describe('formatCell', () => {
  it('marks absence, and never prints it as the word null', () => {
    expect(formatCell(null)).toBe('∅')
    expect(formatCell(undefined)).toBe('∅')
  })

  it('prints a bigint without the n JavaScript would append', () => {
    expect(formatCell(9007199254740993n)).toBe('9007199254740993')
  })
})

describe('numericColumns', () => {
  it('reads the first cell that is not absent, not the first cell', () => {
    expect(
      numericColumns(2, [
        [null, null],
        [null, 12],
        ['a', 13]
      ])
    ).toEqual([false, true])
  })

  it('counts bigint as numeric — DuckDB returns integers that way', () => {
    expect(numericColumns(1, [[7n]])).toEqual([true])
  })

  it('leaves a column of only nulls aligned like text, having nothing to compare', () => {
    expect(numericColumns(1, [[null], [null]])).toEqual([false])
  })

  it('answers for every column even when no row arrived', () => {
    expect(numericColumns(3, [])).toEqual([false, false, false])
  })
})
