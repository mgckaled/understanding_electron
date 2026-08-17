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

  // A hand-built minimal PDF (see extractPdf.test.ts for the byte-offset
  // reasoning) — exercises the real .pdf branch through attachDocument, not
  // a stub, so a wiring mistake between formatOf and extractByFormat shows.
  function buildMinimalPdf(contentStream: string): Buffer {
    const objects: Record<number, string> = {
      1: '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      2: '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      3: '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 300 144] /Contents 5 0 R >>\nendobj\n',
      4: '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
      5: `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`
    }
    let body = '%PDF-1.4\n'
    const offsets: number[] = [0]
    for (let i = 1; i <= 5; i++) {
      offsets[i] = Buffer.byteLength(body, 'latin1')
      body += objects[i]
    }
    const xrefOffset = Buffer.byteLength(body, 'latin1')
    let xref = 'xref\n0 6\n0000000000 65535 f \n'
    for (let i = 1; i <= 5; i++) {
      xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
    }
    const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
    return Buffer.from(body + xref + trailer, 'latin1')
  }

  it('extracts a PDF with a text layer and stores it', async () => {
    const storeAttachment = vi.fn().mockResolvedValue(undefined)
    const pdf = buildMinimalPdf('BT /F1 18 Tf 0 0 Td (Relatorio) Tj ET')
    const readDocumentFile = vi.fn().mockResolvedValue(pdf)

    const result = await attachDocument(
      { path: '/x.pdf', jobId: 'attach-pdf' },
      readDocumentFile,
      '/tmp/attachments',
      storeAttachment,
      vi.fn()
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.format).toBe('pdf')
      expect(result.value.text).toContain('Relatorio')
    }
    expect(storeAttachment).toHaveBeenCalledOnce()
  })

  it('refuses a scanned PDF as blocked and never stores it (D17.3, D17.8)', async () => {
    const storeAttachment = vi.fn()
    const pdf = buildMinimalPdf('')
    const readDocumentFile = vi.fn().mockResolvedValue(pdf)

    const result = await attachDocument(
      { path: '/scan.pdf', jobId: 'attach-scan' },
      readDocumentFile,
      '/tmp/attachments',
      storeAttachment,
      vi.fn()
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('blocked')
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
