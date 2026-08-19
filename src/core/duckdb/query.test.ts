import { join } from 'node:path'
import {
  isValidHash,
  isReadOnlyQuery,
  buildViewSqlParameterized,
  buildViewSqlInterpolated,
  buildFinalSql
} from './query'

const VALID_HASH = 'a'.repeat(64)

describe('isValidHash', () => {
  it('accepts a 64-char lowercase hex digest', () => {
    expect(isValidHash(VALID_HASH)).toBe(true)
  })

  it.each([
    ['too short', 'a'.repeat(63)],
    ['too long', 'a'.repeat(65)],
    ['uppercase', 'A'.repeat(64)],
    ['path traversal attempt', '../../etc/passwd'],
    ['empty string', '']
  ])('rejects %s', (_label, hash) => {
    expect(isValidHash(hash)).toBe(false)
  })
})

describe('isReadOnlyQuery', () => {
  it.each([
    ['select 1'],
    ['  SELECT 1  '],
    ['with cte as (select 1) select * from cte'],
    ['SELECT 1;']
  ])('accepts %s', (sql) => {
    expect(isReadOnlyQuery(sql)).toBe(true)
  })

  it.each([
    ['not a select', 'DROP VIEW dataset'],
    ['insert', 'INSERT INTO dataset VALUES (1)'],
    ['extra statement after the select', 'SELECT 1; DROP VIEW dataset;'],
    ['extra statement, no trailing semicolon', 'SELECT 1; DROP VIEW dataset'],
    ['empty', '']
  ])('rejects %s', (_label, sql) => {
    expect(isReadOnlyQuery(sql)).toBe(false)
  })
})

describe('buildViewSqlParameterized', () => {
  it('binds the resolved path as $1, never interpolated', () => {
    const result = buildViewSqlParameterized(VALID_HASH, '/data/attachments')

    expect(result.sql).toBe('CREATE OR REPLACE VIEW dataset AS SELECT * FROM read_csv_auto($1)')
    expect(result.values).toEqual([join('/data/attachments', VALID_HASH)])
  })

  it('throws on a malformed hash instead of building unsafe SQL', () => {
    expect(() => buildViewSqlParameterized('../escape', '/data/attachments')).toThrow()
  })
})

describe('buildViewSqlInterpolated', () => {
  it('embeds the resolved path as a quoted, forward-slashed literal', () => {
    const sql = buildViewSqlInterpolated(VALID_HASH, 'C:\\data\\attachments')

    expect(sql).toBe(
      `CREATE OR REPLACE VIEW dataset AS SELECT * FROM read_csv_auto('C:/data/attachments/${VALID_HASH}')`
    )
  })

  it('throws on a malformed hash instead of building unsafe SQL', () => {
    expect(() => buildViewSqlInterpolated("'; DROP TABLE x; --", '/data/attachments')).toThrow()
  })
})

describe('buildFinalSql', () => {
  it('wraps the query in a subquery with LIMIT', () => {
    expect(buildFinalSql('SELECT * FROM dataset', 201)).toBe(
      'SELECT * FROM (SELECT * FROM dataset) LIMIT 201'
    )
  })

  it('strips a trailing semicolon before wrapping', () => {
    expect(buildFinalSql('SELECT * FROM dataset;', 50)).toBe(
      'SELECT * FROM (SELECT * FROM dataset) LIMIT 50'
    )
  })

  it('accepts a different limit for a different caller (18-C)', () => {
    expect(buildFinalSql('SELECT 1', 50)).toBe('SELECT * FROM (SELECT 1) LIMIT 50')
  })
})
