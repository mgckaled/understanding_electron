import * as jobs from '../../jobs'
import { attachExcelDataset } from './attachExcel'

function fakeHashOnlyFile(
  digestValue: string,
  runImpl?: (signal: AbortSignal) => Promise<void>
): () => { run: (signal: AbortSignal) => Promise<void>; digest: () => string } {
  return () => ({
    run: runImpl ?? (async () => {}),
    digest: () => digestValue
  })
}

describe('attachExcelDataset', () => {
  it('hashes, stores, then asks the engine for a schema, in that order', async () => {
    const calls: string[] = []
    const storeAttachment = vi.fn().mockImplementation(async () => {
      calls.push('store')
    })
    const runSchema = vi.fn().mockImplementation(async () => {
      calls.push('schema')
      return { columns: ['id', 'nome'], rowCount: 2 }
    })

    const result = await attachExcelDataset(
      { path: '/data/vendas.xlsx', jobId: 'attach-excel-ok' },
      fakeHashOnlyFile('hash-excel'),
      '/tmp/attachments',
      storeAttachment,
      runSchema,
      vi.fn()
    )

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'dataset',
        hash: 'hash-excel',
        fileName: 'vendas.xlsx',
        format: 'excel',
        columns: ['id', 'nome'],
        rowCount: 2
      }
    })
    expect(storeAttachment).toHaveBeenCalledWith(
      '/tmp/attachments',
      'hash-excel',
      '/data/vendas.xlsx'
    )
    expect(runSchema).toHaveBeenCalledWith('hash-excel')
    expect(calls).toEqual(['store', 'schema'])
  })

  it('returns a blocked Result, naming the column, when runSchema rejects a nested type', async () => {
    const storeAttachment = vi.fn().mockResolvedValue(undefined)
    const runSchema = vi
      .fn()
      .mockRejectedValue(new Error('A coluna "endereco" tem um valor aninhado (STRUCT(...)).'))

    const result = await attachExcelDataset(
      { path: '/data/aninhado.xlsx', jobId: 'attach-excel-nested' },
      fakeHashOnlyFile('hash-nested'),
      '/tmp/attachments',
      storeAttachment,
      runSchema,
      vi.fn()
    )

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'blocked',
        reason: 'A coluna "endereco" tem um valor aninhado (STRUCT(...)).'
      }
    })
    // Already copied to attachmentsDir — collectOrphanedAttachments (D16.2)
    // sweeps it, since it never becomes part of any message.
    expect(storeAttachment).toHaveBeenCalled()
  })

  it('maps an ENOENT error and never stores anything when the read fails', async () => {
    const fsError = Object.assign(new Error('no such file'), { code: 'ENOENT' })
    const storeAttachment = vi.fn()
    const runSchema = vi.fn()

    const result = await attachExcelDataset(
      { path: '/missing.xlsx', jobId: 'attach-excel-missing' },
      fakeHashOnlyFile('unused', async () => {
        throw fsError
      }),
      '/tmp/attachments',
      storeAttachment,
      runSchema,
      vi.fn()
    )

    expect(result).toEqual({ ok: false, error: { kind: 'not-found', path: '/missing.xlsx' } })
    expect(storeAttachment).not.toHaveBeenCalled()
    expect(runSchema).not.toHaveBeenCalled()
  })

  it('never stores anything when the job is cancelled mid-hash', async () => {
    const jobId = 'attach-excel-cancel'
    const storeAttachment = vi.fn()
    const runSchema = vi.fn()
    const createHashOnlyFile = (): {
      run: (signal: AbortSignal) => Promise<void>
      digest: () => string
    } => ({
      run: async (signal) => {
        jobs.cancel(jobId)
        // A real stream.destroy() triggered by the abort listener would
        // reject or resolve early — this stands in for that, since the
        // fake never actually reads bytes.
        expect(signal.aborted).toBe(true)
      },
      digest: () => 'unused'
    })

    const result = await attachExcelDataset(
      { path: '/x.xlsx', jobId },
      createHashOnlyFile,
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
