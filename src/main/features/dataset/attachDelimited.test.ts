import * as jobs from '../../jobs'
import { attachDelimitedDataset } from './attachDelimited'

function throwingLines(error: Error): AsyncIterable<string> {
  return {
    [Symbol.asyncIterator]() {
      return { next: (): Promise<IteratorResult<string>> => Promise.reject(error) }
    }
  }
}

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

describe('attachDelimitedDataset', () => {
  it('returns the dataset part and stores the file under its hash', async () => {
    const storeAttachment = vi.fn().mockResolvedValue(undefined)

    const result = await attachDelimitedDataset(
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
        format: 'delimited',
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

    const result = await attachDelimitedDataset(
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

    const result = await attachDelimitedDataset(
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
