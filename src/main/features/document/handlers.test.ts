import { createHash } from 'node:crypto'
import * as jobs from '../../jobs'
import { pickDocument, attachDocument } from './handlers'

describe('pickDocument', () => {
  it('returns the picked path with its size when the user selects a file', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/a.md'] })
    const statSize = vi.fn().mockResolvedValue(1234)

    const result = await pickDocument(undefined, showOpenDialog, statSize)

    expect(result).toEqual({ ok: true, value: { path: '/a.md', sizeBytes: 1234 } })
  })

  it('degrades to no size when the follow-up stat fails', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/a.md'] })
    const statSize = vi.fn().mockRejectedValue(new Error('gone between dialog and stat'))

    const result = await pickDocument(undefined, showOpenDialog, statSize)

    expect(result).toEqual({ ok: true, value: { path: '/a.md', sizeBytes: undefined } })
  })

  it('returns ok(null) when the user cancels the dialog', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({ canceled: true, filePaths: [] })
    const statSize = vi.fn()

    const result = await pickDocument(undefined, showOpenDialog, statSize)

    expect(result).toEqual({ ok: true, value: null })
    expect(statSize).not.toHaveBeenCalled()
  })
})

describe('attachDocument', () => {
  it('returns the document part with text decoded and format from the extension', async () => {
    const storeAttachment = vi.fn().mockResolvedValue(undefined)
    const readDocumentFile = vi.fn().mockResolvedValue(Buffer.from('# título\ncorpo', 'utf8'))

    const result = await attachDocument(
      { path: '/notas/leia.md', jobId: 'attach-ok' },
      readDocumentFile,
      '/tmp/attachments',
      storeAttachment,
      vi.fn()
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.kind).toBe('document')
    expect(result.value.format).toBe('md')
    expect(result.value.fileName).toBe('leia.md')
    expect(result.value.text).toBe('# título\ncorpo')
    expect(result.value.hash).toBe(
      createHash('sha256').update(Buffer.from('# título\ncorpo', 'utf8')).digest('hex')
    )
    expect(storeAttachment).toHaveBeenCalledWith(
      '/tmp/attachments',
      result.value.hash,
      '/notas/leia.md'
    )
  })

  it('defaults to txt for an unrecognized extension', async () => {
    const readDocumentFile = vi.fn().mockResolvedValue(Buffer.from('plain', 'utf8'))

    const result = await attachDocument(
      { path: '/x.txt', jobId: 'attach-txt' },
      readDocumentFile,
      '/tmp/attachments',
      vi.fn().mockResolvedValue(undefined),
      vi.fn()
    )

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.format).toBe('txt')
  })

  it('maps an ENOENT error and never stores anything when the read fails', async () => {
    const fsError = Object.assign(new Error('no such file'), { code: 'ENOENT' })
    const storeAttachment = vi.fn()

    const result = await attachDocument(
      { path: '/missing.md', jobId: 'attach-missing' },
      vi.fn().mockRejectedValue(fsError),
      '/tmp/attachments',
      storeAttachment,
      vi.fn()
    )

    expect(result).toEqual({ ok: false, error: { kind: 'not-found', path: '/missing.md' } })
    expect(storeAttachment).not.toHaveBeenCalled()
  })

  it('never stores anything when the job is cancelled mid-read', async () => {
    const jobId = 'attach-cancel'
    const storeAttachment = vi.fn()
    const readDocumentFile = vi
      .fn()
      .mockImplementation(async (_path: string, signal: AbortSignal) => {
        jobs.cancel(jobId)
        return Promise.reject(
          Object.assign(new Error('aborted'), { name: 'AbortError', aborted: signal.aborted })
        )
      })

    const result = await attachDocument(
      { path: '/x.md', jobId },
      readDocumentFile,
      '/tmp/attachments',
      storeAttachment,
      vi.fn()
    )

    expect(result).toEqual({ ok: false, error: { kind: 'cancelled' } })
    expect(storeAttachment).not.toHaveBeenCalled()
  })
})
