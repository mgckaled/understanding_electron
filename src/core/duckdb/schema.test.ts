import { buildDescribeSql, hasNestedType } from './schema'

describe('buildDescribeSql', () => {
  it('describes the given view', () => {
    expect(buildDescribeSql('dataset')).toBe('DESCRIBE SELECT * FROM "dataset"')
  })

  it('escapes a double quote in the view name', () => {
    expect(buildDescribeSql('data"set')).toBe('DESCRIBE SELECT * FROM "data""set"')
  })
})

describe('hasNestedType', () => {
  it.each([
    ['a STRUCT', 'STRUCT(a INTEGER)'],
    ['a MAP', 'MAP(VARCHAR, INTEGER)'],
    ['a LIST', 'INTEGER[]'],
    ['a LIST of STRUCT', 'STRUCT(a INTEGER)[]'],
    // read_json_auto's own fallback for a field whose type disagrees across
    // rows (verified live) — never VARCHAR, so a plain string column is safe.
    ['inconsistent-type JSON', 'JSON']
  ])('flags %s as nested', (_label, columnType) => {
    expect(hasNestedType(columnType)).toBe(true)
  })

  it.each([['VARCHAR'], ['BIGINT'], ['DOUBLE'], ['TIMESTAMP'], ['BOOLEAN']])(
    'does not flag %s',
    (columnType) => {
      expect(hasNestedType(columnType)).toBe(false)
    }
  )
})
