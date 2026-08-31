import type { ColumnProfile, Step } from '@shared/ipc'
import {
  attachDataset,
  queryDataset,
  profileDataset,
  readQueueDepth,
  transformDataset
} from './handlers'

// attachDataset itself only dispatches on sniffFormat (D18E.1/D18E.3) — each
// path's own behavior (delimited: attachDelimited.test.ts, JSON:
// attachJson.test.ts, Excel: attachExcel.test.ts) is tested against
// attachDelimitedDataset/attachJsonDataset/attachExcelDataset directly, not
// re-tested here.
describe('attachDataset (dispatcher)', () => {
  const unusedHashOnlyFile = (): never => {
    throw new Error('createHashOnlyFile should not be called for this format')
  }
  const unusedHashedLines = (): never => {
    throw new Error('createHashedLines should not be called for this format')
  }

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
      unusedHashOnlyFile,
      { attachmentsDir: '/tmp/attachments', storeAttachment },
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
      unusedHashOnlyFile,
      { attachmentsDir: '/tmp/attachments', storeAttachment },
      vi.fn(),
      async () => 'delimited',
      runSchema
    )

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.format).toBe('delimited')
    expect(runSchema).not.toHaveBeenCalled()
  })

  it('routes to the excel path when sniffFormat resolves excel', async () => {
    const storeAttachment = vi.fn().mockResolvedValue(undefined)
    const runSchema = vi.fn().mockResolvedValue({ columns: ['id'], rowCount: 1 })
    const createHashOnlyFile = (): {
      run: (signal: AbortSignal) => Promise<void>
      digest: () => string
    } => ({
      run: async () => {},
      digest: () => 'hash-excel'
    })

    const result = await attachDataset(
      { path: '/data/vendas.xlsx', jobId: 'dispatch-excel' },
      unusedHashedLines,
      createHashOnlyFile,
      { attachmentsDir: '/tmp/attachments', storeAttachment },
      vi.fn(),
      async () => 'excel',
      runSchema
    )

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.format).toBe('excel')
    expect(runSchema).toHaveBeenCalledWith('hash-excel')
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

describe('transformDataset', () => {
  const VALID_HASH = 'a'.repeat(64)
  const STEPS: Step[] = [{ kind: 'filter', column: 'idade', operator: 'gt', value: 18 }]
  const PROFILE: ColumnProfile[] = [
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

  it('compiles the steps against the fetched schema and returns the transform result', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const runSchema = vi.fn().mockResolvedValue({ columns: ['idade'], rowCount: 100 })
    const runTransform = vi.fn().mockResolvedValue({ bytes, before: PROFILE, after: PROFILE })

    const result = await transformDataset(
      { hash: VALID_HASH, steps: STEPS },
      runSchema,
      runTransform
    )

    expect(result).toEqual({ ok: true, value: { bytes, before: PROFILE, after: PROFILE } })
    expect(runSchema).toHaveBeenCalledWith(VALID_HASH)
    expect(runTransform).toHaveBeenCalledWith(
      VALID_HASH,
      'SELECT * FROM (SELECT * FROM "dataset") WHERE "idade" > 18'
    )
  })

  it('rejects a malformed hash without ever calling runSchema or runTransform', async () => {
    const runSchema = vi.fn()
    const runTransform = vi.fn()

    const result = await transformDataset(
      { hash: 'not-a-hash', steps: STEPS },
      runSchema,
      runTransform
    )

    expect(result).toEqual({
      ok: false,
      error: { kind: 'invalidQuery', message: 'Identificador de anexo inválido.' }
    })
    expect(runSchema).not.toHaveBeenCalled()
    expect(runTransform).not.toHaveBeenCalled()
  })

  it('wraps a compile error (unknown column) as invalidQuery, without calling runTransform', async () => {
    const runSchema = vi.fn().mockResolvedValue({ columns: ['nome'], rowCount: 100 })
    const runTransform = vi.fn()

    const result = await transformDataset(
      { hash: VALID_HASH, steps: STEPS },
      runSchema,
      runTransform
    )

    expect(result).toEqual({
      ok: false,
      error: { kind: 'invalidQuery', message: 'Unknown column: "idade"' }
    })
    expect(runTransform).not.toHaveBeenCalled()
  })

  it('wraps a compile error (isNotNull carrying a value) as invalidQuery, without calling runTransform', async () => {
    const runSchema = vi.fn().mockResolvedValue({ columns: ['idade'], rowCount: 100 })
    const runTransform = vi.fn()
    const inconsistentSteps: Step[] = [
      { kind: 'filter', column: 'idade', operator: 'isNotNull', value: 18 }
    ]

    const result = await transformDataset(
      { hash: VALID_HASH, steps: inconsistentSteps },
      runSchema,
      runTransform
    )

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'invalidQuery',
        message: 'Step "filter" on "idade" (isNotNull) must not carry a value'
      }
    })
    expect(runTransform).not.toHaveBeenCalled()
  })

  it('wraps a real engine error as invalidQuery, with the engine text preserved', async () => {
    const runSchema = vi.fn().mockResolvedValue({ columns: ['idade'], rowCount: 100 })
    const runTransform = vi.fn().mockRejectedValue(new Error('Out of Memory Error'))

    const result = await transformDataset(
      { hash: VALID_HASH, steps: STEPS },
      runSchema,
      runTransform
    )

    expect(result).toEqual({
      ok: false,
      error: { kind: 'invalidQuery', message: 'Out of Memory Error' }
    })
  })
})

describe('readQueueDepth', () => {
  it('reports what the source returns', () => {
    const getDepth = vi.fn().mockReturnValue(2)

    expect(readQueueDepth(getDepth)).toBe(2)
  })
})
