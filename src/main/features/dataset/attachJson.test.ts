import * as jobs from '../../jobs'
import { attachJsonDataset } from './attachJson'

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

describe('attachJsonDataset', () => {
  it('hashes, stores, then asks the engine for a schema, in that order', async () => {
    const calls: string[] = []
    const storeAttachment = vi.fn().mockImplementation(async () => {
      calls.push('store')
    })
    const runSchema = vi.fn().mockImplementation(async () => {
      calls.push('schema')
      return { columns: ['id', 'nome'], rowCount: 2 }
    })

    const result = await attachJsonDataset(
      { path: '/data/vendas.json', jobId: 'attach-json-ok' },
      fakeHashedLines(['{"id": 1, "nome": "Ana"}', '{"id": 2, "nome": "Bruno"}'], 'hash-json'),
      '/tmp/attachments',
      storeAttachment,
      runSchema,
      vi.fn()
    )

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'dataset',
        hash: 'hash-json',
        fileName: 'vendas.json',
        format: 'json',
        columns: ['id', 'nome'],
        rowCount: 2
      }
    })
    expect(storeAttachment).toHaveBeenCalledWith(
      '/tmp/attachments',
      'hash-json',
      '/data/vendas.json'
    )
    expect(runSchema).toHaveBeenCalledWith('hash-json')
    expect(calls).toEqual(['store', 'schema'])
  })

  it('returns a blocked Result, naming the column, when runSchema rejects a nested type', async () => {
    const storeAttachment = vi.fn().mockResolvedValue(undefined)
    const runSchema = vi
      .fn()
      .mockRejectedValue(
        new Error(
          'A coluna "endereco" tem um valor aninhado (STRUCT(cidade VARCHAR)), que este app não trata.'
        )
      )

    const result = await attachJsonDataset(
      { path: '/data/aninhado.json', jobId: 'attach-json-nested' },
      fakeHashedLines(['{"id": 1, "endereco": {"cidade": "SP"}}'], 'hash-nested'),
      '/tmp/attachments',
      storeAttachment,
      runSchema,
      vi.fn()
    )

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'blocked',
        reason:
          'A coluna "endereco" tem um valor aninhado (STRUCT(cidade VARCHAR)), que este app não trata.'
      }
    })
    // Already copied to attachmentsDir — collectOrphanedAttachments (D16.2)
    // sweeps it, since it never becomes part of any message (D18E.3).
    expect(storeAttachment).toHaveBeenCalled()
  })

  it('maps an ENOENT error and never stores anything when the read fails', async () => {
    const fsError = Object.assign(new Error('no such file'), { code: 'ENOENT' })
    const storeAttachment = vi.fn()
    const runSchema = vi.fn()

    const result = await attachJsonDataset(
      { path: '/missing.json', jobId: 'attach-json-missing' },
      () => ({ lines: throwingLines(fsError), digest: () => 'unused' }),
      '/tmp/attachments',
      storeAttachment,
      runSchema,
      vi.fn()
    )

    expect(result).toEqual({ ok: false, error: { kind: 'not-found', path: '/missing.json' } })
    expect(storeAttachment).not.toHaveBeenCalled()
    expect(runSchema).not.toHaveBeenCalled()
  })

  it('never stores anything when the job is cancelled mid-drain', async () => {
    const jobId = 'attach-json-cancel'
    const storeAttachment = vi.fn()
    const runSchema = vi.fn()
    const createHashedLines = (): { lines: AsyncIterable<string>; digest: () => string } => ({
      lines: (async function* () {
        yield '{"id": 1}'
        jobs.cancel(jobId)
        yield '{"id": 2}'
      })(),
      digest: () => 'unused'
    })

    const result = await attachJsonDataset(
      { path: '/x.json', jobId },
      createHashedLines,
      '/tmp/attachments',
      storeAttachment,
      runSchema,
      vi.fn()
    )

    expect(result).toEqual({ ok: false, error: { kind: 'cancelled' } })
    expect(storeAttachment).not.toHaveBeenCalled()
    expect(runSchema).not.toHaveBeenCalled()
  })
})
