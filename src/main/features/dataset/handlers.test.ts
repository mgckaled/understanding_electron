import type { ColumnProfile } from '@shared/ipc'
import { pickDataset, attachDataset, queryDataset, profileDataset } from './handlers'

describe('pickDataset', () => {
  it('returns the picked path when the user selects a file', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/a.csv'] })

    const result = await pickDataset(undefined, showOpenDialog)

    expect(result).toEqual({ ok: true, value: { path: '/a.csv' } })
  })

  it('returns ok(null) when the user cancels the dialog', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({ canceled: true, filePaths: [] })

    const result = await pickDataset(undefined, showOpenDialog)

    expect(result).toEqual({ ok: true, value: null })
  })

  // Regression: the OS dialog shows only the FIRST filter by default — a
  // JSON-only second filter left JSON/NDJSON invisible until the user
  // manually switched the dropdown (found live, fixed post-18-E). The first
  // filter must list every extension this button supports.
  it('lists every supported extension in the first (default) filter', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({ canceled: true, filePaths: [] })

    await pickDataset(undefined, showOpenDialog)

    const { filters } = showOpenDialog.mock.calls[0][0]
    expect(filters[0].extensions).toEqual(
      expect.arrayContaining(['csv', 'tsv', 'txt', 'json', 'ndjson', 'jsonl'])
    )
  })
})

// attachDataset itself only dispatches on sniffFormat (D18E.1/D18E.3) — each
// path's own behavior (delimited: attachDelimited.test.ts, JSON:
// attachJson.test.ts) is tested against attachDelimitedDataset/
// attachJsonDataset directly, not re-tested here.
describe('attachDataset (dispatcher)', () => {
  it('routes to the JSON path when sniffFormat resolves json', async () => {
    const storeAttachment = vi.fn().mockResolvedValue(undefined)
    const runSchema = vi.fn().mockResolvedValue({ columns: ['id'], rowCount: 1 })
    const createHashedLines = (): { lines: AsyncIterable<string>; digest: () => string } => ({
      lines: (async function* () {
        yield '{"id": 1}'
      })(),
      digest: () => 'hash-json'
    })

    const result = await attachDataset(
      { path: '/data/vendas.json', jobId: 'dispatch-json' },
      createHashedLines,
      '/tmp/attachments',
      storeAttachment,
      vi.fn(),
      async () => 'json',
      runSchema
    )

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.format).toBe('json')
    expect(runSchema).toHaveBeenCalledWith('hash-json')
  })

  it('routes to the delimited path when sniffFormat resolves delimited', async () => {
    const storeAttachment = vi.fn().mockResolvedValue(undefined)
    const runSchema = vi.fn()
    const createHashedLines = (): { lines: AsyncIterable<string>; digest: () => string } => ({
      lines: (async function* () {
        yield 'id,name'
        yield '1,Ana'
      })(),
      digest: () => 'hash-csv'
    })

    const result = await attachDataset(
      { path: '/data/vendas.csv', jobId: 'dispatch-csv' },
      createHashedLines,
      '/tmp/attachments',
      storeAttachment,
      vi.fn(),
      async () => 'delimited',
      runSchema
    )

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.format).toBe('delimited')
    expect(runSchema).not.toHaveBeenCalled()
  })
})

describe('queryDataset', () => {
  const VALID_HASH = 'a'.repeat(64)

  it('calls runQuery with the final SQL, wrapped in the row cap, and returns its bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const runQuery = vi.fn().mockResolvedValue(bytes)

    const result = await queryDataset({ hash: VALID_HASH, sql: 'select * from dataset' }, runQuery)

    expect(result).toEqual({ ok: true, value: bytes })
    expect(runQuery).toHaveBeenCalledWith(
      VALID_HASH,
      'SELECT * FROM (select * from dataset) LIMIT 201'
    )
  })

  it('rejects a malformed hash without ever calling runQuery', async () => {
    const runQuery = vi.fn()

    const result = await queryDataset({ hash: 'not-a-hash', sql: 'select 1' }, runQuery)

    expect(result).toEqual({
      ok: false,
      error: { kind: 'invalidQuery', message: 'Identificador de anexo inválido.' }
    })
    expect(runQuery).not.toHaveBeenCalled()
  })

  it('rejects a non-read-only query without ever calling runQuery', async () => {
    const runQuery = vi.fn()

    const result = await queryDataset({ hash: VALID_HASH, sql: 'DROP VIEW dataset' }, runQuery)

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'invalidQuery',
        message: 'Apenas consultas de leitura (SELECT/WITH) são permitidas.'
      }
    })
    expect(runQuery).not.toHaveBeenCalled()
  })

  it('wraps a real engine error as invalidQuery, with the engine text preserved', async () => {
    const runQuery = vi.fn().mockRejectedValue(new Error('Binder Error: column "x" not found'))

    const result = await queryDataset({ hash: VALID_HASH, sql: 'select x from dataset' }, runQuery)

    expect(result).toEqual({
      ok: false,
      error: { kind: 'invalidQuery', message: 'Binder Error: column "x" not found' }
    })
  })
})

describe('profileDataset', () => {
  const VALID_HASH = 'a'.repeat(64)

  it('calls runProfile with the hash and returns its profile', async () => {
    const profile: ColumnProfile[] = [
      {
        column: 'idade',
        type: 'BIGINT',
        nullPercentage: 0,
        approxUnique: 40,
        min: '18',
        max: '65',
        avg: 34.2
      }
    ]
    const runProfile = vi.fn().mockResolvedValue(profile)

    const result = await profileDataset({ hash: VALID_HASH }, runProfile)

    expect(result).toEqual({ ok: true, value: profile })
    expect(runProfile).toHaveBeenCalledWith(VALID_HASH)
  })

  it('rejects a malformed hash without ever calling runProfile', async () => {
    const runProfile = vi.fn()

    const result = await profileDataset({ hash: 'not-a-hash' }, runProfile)

    expect(result).toEqual({
      ok: false,
      error: { kind: 'invalidQuery', message: 'Identificador de anexo inválido.' }
    })
    expect(runProfile).not.toHaveBeenCalled()
  })

  it('wraps a real engine error as invalidQuery, with the engine text preserved', async () => {
    const runProfile = vi.fn().mockRejectedValue(new Error('Out of Memory Error'))

    const result = await profileDataset({ hash: VALID_HASH }, runProfile)

    expect(result).toEqual({
      ok: false,
      error: { kind: 'invalidQuery', message: 'Out of Memory Error' }
    })
  })
})
