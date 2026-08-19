import * as jobs from '../../jobs'
import { pickDataset, attachDataset, queryDataset } from './handlers'

function throwingLines(error: Error): AsyncIterable<string> {
  return {
    [Symbol.asyncIterator]() {
      return { next: (): Promise<IteratorResult<string>> => Promise.reject(error) }
    }
  }
}

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
})

describe('attachDataset', () => {
  function fakeHashedLines(
    lines: string[],
    digestValue: string
  ): () => { lines: AsyncIterable<string>; digest: () => string } {
    return () => ({
      lines: (async function* () {
        for (const line of lines) yield line
      })(),
      digest: () => digestValue
    })
  }

  it('returns the dataset part and stores the file under its hash', async () => {
    const storeAttachment = vi.fn().mockResolvedValue(undefined)

    const result = await attachDataset(
      { path: '/data/vendas.csv', jobId: 'attach-ok' },
      fakeHashedLines(['id,name', '1,Ana', '2,Bruno'], 'hash-abc'),
      '/tmp/attachments',
      storeAttachment,
      vi.fn()
    )

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'dataset',
        hash: 'hash-abc',
        fileName: 'vendas.csv',
        delimiter: ',',
        columns: ['id', 'name'],
        rowCount: 2
      }
    })
    expect(storeAttachment).toHaveBeenCalledWith('/tmp/attachments', 'hash-abc', '/data/vendas.csv')
  })

  it('maps an ENOENT error and never stores anything when the read fails', async () => {
    const fsError = Object.assign(new Error('no such file'), { code: 'ENOENT' })
    const storeAttachment = vi.fn()

    const result = await attachDataset(
      { path: '/missing.csv', jobId: 'attach-missing' },
      () => ({ lines: throwingLines(fsError), digest: () => 'unused' }),
      '/tmp/attachments',
      storeAttachment,
      vi.fn()
    )

    expect(result).toEqual({ ok: false, error: { kind: 'not-found', path: '/missing.csv' } })
    expect(storeAttachment).not.toHaveBeenCalled()
  })

  it('never stores anything when the job is cancelled mid-scan', async () => {
    const jobId = 'attach-cancel'
    const storeAttachment = vi.fn()
    const createHashedLines = (): { lines: AsyncIterable<string>; digest: () => string } => ({
      lines: (async function* () {
        yield 'id,name'
        yield '1,Ana'
        jobs.cancel(jobId)
        yield '2,Bruno'
      })(),
      digest: () => 'unused'
    })

    const result = await attachDataset(
      { path: '/x.csv', jobId },
      createHashedLines,
      '/tmp/attachments',
      storeAttachment,
      vi.fn()
    )

    expect(result).toEqual({ ok: false, error: { kind: 'cancelled' } })
    expect(storeAttachment).not.toHaveBeenCalled()
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
