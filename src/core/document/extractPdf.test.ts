import { extractPdfText } from './extractPdf'

// A hand-built minimal PDF, not a fixture file — offsets are computed as the
// body is assembled, so the xref table is always correct for whatever
// content stream is passed in. An empty content stream (no Tj operator)
// stands in for a scanned page: no text object, so pdf.js extracts nothing.
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

describe('extractPdfText', () => {
  it('extracts the text layer of a PDF that has one', async () => {
    const pdf = buildMinimalPdf('BT /F1 18 Tf 0 0 Td (Hello World) Tj ET')

    const result = await extractPdfText(pdf)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toContain('Hello World')
  })

  it('refuses a PDF with no text layer — a scanned page, not OCR territory (D17.3)', async () => {
    const pdf = buildMinimalPdf('')

    const result = await extractPdfText(pdf)

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'blocked',
        reason: expect.stringContaining('texto selecionável')
      }
    })
  })
})
