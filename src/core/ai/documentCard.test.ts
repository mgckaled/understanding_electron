import type { DocumentPart } from '@shared/ipc'
import { formatDocumentCard } from './documentCard'

function documentPart(overrides: Partial<DocumentPart> = {}): DocumentPart {
  return {
    kind: 'document',
    hash: 'abc123',
    fileName: 'especificacao.md',
    format: 'md',
    text: '# título\ncorpo do documento',
    ...overrides
  }
}

describe('formatDocumentCard', () => {
  it('includes the file name and the extracted text verbatim', () => {
    const card = formatDocumentCard(documentPart())

    expect(card).toContain('especificacao.md')
    expect(card).toContain('# título\ncorpo do documento')
  })

  it('never rewords or trims the text', () => {
    const text = 'linha um\n\nlinha dois com espaços   extras'
    const card = formatDocumentCard(documentPart({ text }))

    expect(card).toContain(text)
  })
})
