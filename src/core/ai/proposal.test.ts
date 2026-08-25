import type { ChatMessage, ColumnProfile, DatasetPart } from '@shared/ipc'
import { buildProposalMessages, requestStepProposal } from './proposal'
import type { ChatFn } from './types'

function datasetPart(overrides: Partial<DatasetPart> = {}): DatasetPart {
  return {
    kind: 'dataset',
    hash: 'abc123',
    fileName: 'vendas.csv',
    format: 'delimited',
    delimiter: ',',
    columns: ['idade', 'cidade'],
    rowCount: 100,
    ...overrides
  }
}

function textOf(messages: ChatMessage[]): string {
  return messages.map((m) => m.content).join('\n')
}

describe('buildProposalMessages', () => {
  it('includes the schema and the request text', () => {
    const messages = buildProposalMessages(datasetPart(), undefined, 'filtre idade > 18')

    expect(textOf(messages)).toContain('idade, cidade')
    expect(textOf(messages)).toContain('filtre idade > 18')
  })

  it('includes column type and nullPercentage when a profile is given', () => {
    const profile: ColumnProfile[] = [
      {
        column: 'idade',
        type: 'BIGINT',
        nullPercentage: 12.5,
        approxUnique: 40,
        min: '18',
        max: '65',
        avg: 34.2
      }
    ]

    const messages = buildProposalMessages(datasetPart(), profile, 'preencha os nulos')

    expect(textOf(messages)).toContain('BIGINT')
    expect(textOf(messages)).toContain('12.5%')
  })

  it("never includes topValues — a column's most frequent values are row content", () => {
    const SENTINEL = 'SENTINEL_TOP_VALUE_9c2f'
    const profile: ColumnProfile[] = [
      {
        column: 'cidade',
        type: 'VARCHAR',
        nullPercentage: 0,
        approxUnique: 3,
        min: 'A',
        max: 'Z',
        avg: null,
        topValues: [{ value: SENTINEL, count: 50 }]
      }
    ]

    const messages = buildProposalMessages(datasetPart(), profile, 'agrupe por cidade')

    expect(textOf(messages)).not.toContain(SENTINEL)
  })

  it('omits the profile section entirely when no profile is given', () => {
    const withProfile = buildProposalMessages(
      datasetPart(),
      [
        {
          column: 'idade',
          type: 'BIGINT',
          nullPercentage: 0,
          approxUnique: 1,
          min: '1',
          max: '1',
          avg: 1
        }
      ],
      'x'
    )
    const withoutProfile = buildProposalMessages(datasetPart(), undefined, 'x')

    expect(textOf(withoutProfile).length).toBeLessThan(textOf(withProfile).length)
  })
})

describe('requestStepProposal', () => {
  const card = datasetPart()

  it('resolves a valid steps proposal from the chat fn', async () => {
    const chat: ChatFn = async () => ({
      content: JSON.stringify({
        kind: 'steps',
        steps: [{ kind: 'filter', column: 'idade', operator: 'gt', value: 18 }]
      })
    })

    const result = await requestStepProposal(chat, {
      card,
      request: 'filtre maiores de 18',
      model: 'gemma3:4b'
    })

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'steps',
        steps: [{ kind: 'filter', column: 'idade', operator: 'gt', value: 18 }]
      }
    })
  })

  it('reports invalidProposal for a reply outside the schema', async () => {
    const chat: ChatFn = async () => ({ content: JSON.stringify({ kind: 'steps', steps: [] }) })

    const result = await requestStepProposal(chat, { card, request: 'x', model: 'gemma3:4b' })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.kind).toBe('invalidProposal')
  })

  it('sends the step proposal JSON schema as format', async () => {
    const chat = vi.fn<ChatFn>(async () => ({
      content: JSON.stringify({ kind: 'steps', steps: [{ kind: 'limit', count: 5 }] })
    }))

    await requestStepProposal(chat, { card, request: 'limite a 5', model: 'gemma3:4b' })

    expect(chat).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ format: expect.objectContaining({ oneOf: expect.any(Array) }) })
    )
  })
})
