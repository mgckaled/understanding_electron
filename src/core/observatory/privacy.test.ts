import type { Message } from '@shared/ipc'
import { countAttachments } from './privacy'

function textMessage(text: string): Message {
  return { id: 'm', role: 'user', parts: [{ kind: 'text', text }], createdAt: 0 }
}

describe('countAttachments', () => {
  it('is zero for a transcript with no attachment part', () => {
    expect(countAttachments([textMessage('oi')])).toEqual({
      datasetCount: 0,
      documentCount: 0,
      imageCount: 0
    })
  })

  it('counts each kind across the whole transcript, not just one message', () => {
    const messages: Message[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [
          {
            kind: 'dataset',
            hash: 'h1',
            fileName: 'vendas.csv',
            format: 'delimited',
            delimiter: ',',
            columns: ['id'],
            rowCount: 1
          },
          { kind: 'text', text: 'o que tem aqui?' }
        ],
        createdAt: 0
      },
      { id: 'm2', role: 'assistant', parts: [{ kind: 'text', text: 'uma coluna' }], createdAt: 1 },
      {
        id: 'm3',
        role: 'user',
        parts: [{ kind: 'image', hash: 'h2', fileName: 'foto.png', mimeType: 'image/png' }],
        createdAt: 2
      }
    ]

    expect(countAttachments(messages)).toEqual({ datasetCount: 1, documentCount: 0, imageCount: 1 })
  })

  it('counts more than one attachment part in a single message', () => {
    const messages: Message[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [
          {
            kind: 'dataset',
            hash: 'h1',
            fileName: 'vendas.csv',
            format: 'delimited',
            delimiter: ',',
            columns: ['id'],
            rowCount: 1
          },
          {
            kind: 'document',
            hash: 'h2',
            fileName: 'contrato.pdf',
            format: 'pdf',
            text: 'texto'
          }
        ],
        createdAt: 0
      }
    ]

    expect(countAttachments(messages)).toEqual({ datasetCount: 1, documentCount: 1, imageCount: 0 })
  })

  it('the same attachment resent across turns counts once per turn (stateless provider)', () => {
    const withDataset: Message = {
      id: 'm1',
      role: 'user',
      parts: [
        {
          kind: 'dataset',
          hash: 'h1',
          fileName: 'vendas.csv',
          format: 'delimited',
          delimiter: ',',
          columns: ['id'],
          rowCount: 1
        }
      ],
      createdAt: 0
    }
    // The transcript resent for turn 2 still carries turn 1's message.
    expect(countAttachments([withDataset, textMessage('e agora?')])).toEqual({
      datasetCount: 1,
      documentCount: 0,
      imageCount: 0
    })
  })
})
