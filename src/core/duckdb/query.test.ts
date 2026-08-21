import {
  isValidHash,
  isReadOnlyQuery,
  buildViewSqlInterpolated,
  buildFinalSql,
  isUtf8EncodingError,
  ensureDatasetView
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

describe('buildViewSqlInterpolated', () => {
  it('embeds the resolved path as a quoted, forward-slashed literal', () => {
    const sql = buildViewSqlInterpolated(VALID_HASH, 'C:\\data\\attachments', 'delimited')

    expect(sql).toBe(
      `CREATE OR REPLACE VIEW dataset AS SELECT * FROM read_csv_auto('C:/data/attachments/${VALID_HASH}')`
    )
  })

  it('throws on a malformed hash instead of building unsafe SQL', () => {
    expect(() =>
      buildViewSqlInterpolated("'; DROP TABLE x; --", '/data/attachments', 'delimited')
    ).toThrow()
  })

  it('appends an encoding clause when given one', () => {
    const sql = buildViewSqlInterpolated(
      VALID_HASH,
      'C:\\data\\attachments',
      'delimited',
      'latin-1'
    )

    expect(sql).toBe(
      `CREATE OR REPLACE VIEW dataset AS SELECT * FROM read_csv_auto('C:/data/attachments/${VALID_HASH}', encoding = 'latin-1')`
    )
  })

  it('dispatches to read_json_auto for format "json", with no encoding clause', () => {
    const sql = buildViewSqlInterpolated(VALID_HASH, 'C:\\data\\attachments', 'json')

    expect(sql).toBe(
      `CREATE OR REPLACE VIEW dataset AS SELECT * FROM read_json_auto('C:/data/attachments/${VALID_HASH}')`
    )
  })

  it('dispatches to read_xlsx for format "excel", with header = true and no encoding clause', () => {
    const sql = buildViewSqlInterpolated(VALID_HASH, 'C:\\data\\attachments', 'excel')

    expect(sql).toBe(
      `CREATE OR REPLACE VIEW dataset AS SELECT * FROM read_xlsx('C:/data/attachments/${VALID_HASH}', header = true)`
    )
  })
})

describe('isUtf8EncodingError', () => {
  // Captured from a real DuckDB read_csv_auto failure against a Latin-1
  // fixture (§ HISTORY.md) — matching against the real string, not a guess.
  const REAL_MESSAGE = `Invalid Input Error: CSV Error on Line: 2
Original Line: cliente_id;nome;cidade;vip;email
Invalid unicode (byte sequence mismatch) detected. This file is not utf-8 encoded.

Possible Solution: Set the correct encoding, if available, to read this CSV File (e.g., encoding='UTF-16')`

  it('matches the real engine message', () => {
    expect(isUtf8EncodingError(REAL_MESSAGE)).toBe(true)
  })

  it('does not match an unrelated engine error', () => {
    expect(isUtf8EncodingError('Binder Error: column "missing_column" does not exist')).toBe(false)
  })

  it('does not match the latin-1 decoder rejecting its own retry', () => {
    expect(isUtf8EncodingError('Invalid Input Error: File is not latin-1 encoded')).toBe(false)
  })
})

describe('ensureDatasetView', () => {
  it('builds the plain view and returns no encoding when the first attempt succeeds', async () => {
    const run = vi.fn().mockResolvedValue(undefined)

    const encoding = await ensureDatasetView({
      hash: VALID_HASH,
      attachmentsDir: '/data/attachments',
      format: 'delimited',
      knownEncoding: undefined,
      run
    })

    expect(encoding).toBeUndefined()
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith(expect.not.stringContaining('encoding'))
  })

  it('retries once with latin-1 when the first attempt fails on invalid utf-8', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          'Invalid unicode (byte sequence mismatch) detected. This file is not utf-8 encoded.'
        )
      )
      .mockResolvedValueOnce(undefined)

    const encoding = await ensureDatasetView({
      hash: VALID_HASH,
      attachmentsDir: '/data/attachments',
      format: 'delimited',
      knownEncoding: undefined,
      run
    })

    expect(encoding).toBe('latin-1')
    expect(run).toHaveBeenCalledTimes(2)
    expect(run).toHaveBeenLastCalledWith(expect.stringContaining("encoding = 'latin-1'"))
  })

  it('skips straight to latin-1 when the hash was already classified', async () => {
    const run = vi.fn().mockResolvedValue(undefined)

    const encoding = await ensureDatasetView({
      hash: VALID_HASH,
      attachmentsDir: '/data/attachments',
      format: 'delimited',
      knownEncoding: 'latin-1',
      run
    })

    expect(encoding).toBe('latin-1')
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith(expect.stringContaining("encoding = 'latin-1'"))
  })

  it('re-throws a non-encoding error without retrying', async () => {
    const run = vi.fn().mockRejectedValue(new Error('Binder Error: syntax error'))

    await expect(
      ensureDatasetView({
        hash: VALID_HASH,
        attachmentsDir: '/data/attachments',
        format: 'delimited',
        knownEncoding: undefined,
        run
      })
    ).rejects.toThrow('Binder Error: syntax error')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('builds the plain view and returns no encoding for format "excel", skipping the dance', async () => {
    const run = vi.fn().mockResolvedValue(undefined)

    const encoding = await ensureDatasetView({
      hash: VALID_HASH,
      attachmentsDir: '/data/attachments',
      format: 'excel',
      knownEncoding: undefined,
      run
    })

    expect(encoding).toBeUndefined()
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith(expect.stringContaining('read_xlsx'))
  })

  it('re-throws the original utf-8 error when the latin-1 retry itself fails', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('This file is not utf-8 encoded.'))
      .mockRejectedValueOnce(new Error('Invalid Input Error: File is not latin-1 encoded'))

    await expect(
      ensureDatasetView({
        hash: VALID_HASH,
        attachmentsDir: '/data/attachments',
        format: 'delimited',
        knownEncoding: undefined,
        run
      })
    ).rejects.toThrow('This file is not utf-8 encoded.')
    expect(run).toHaveBeenCalledTimes(2)
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
