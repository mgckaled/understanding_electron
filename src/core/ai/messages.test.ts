import type { DatasetPart, DocumentPart, ImagePart, Message } from '@shared/ipc'
import {
  attachmentPartOf,
  checkLevel3,
  imageCountOf,
  isCloudService,
  messageText,
  toChatMessages,
  toChatMessagesWithImages
} from './messages'

function message(role: Message['role'], ...texts: string[]): Message {
  return {
    id: `m-${role}-${texts.join('')}`,
    role,
    parts: texts.map((text) => ({ kind: 'text', text })),
    createdAt: 0
  }
}

const datasetPart: DatasetPart = {
  kind: 'dataset',
  hash: 'abc123',
  fileName: 'vendas.csv',
  format: 'delimited',
  delimiter: ',',
  columns: ['id', 'valor'],
  rowCount: 10
}

const documentPart: DocumentPart = {
  kind: 'document',
  hash: 'def456',
  fileName: 'especificacao.md',
  format: 'md',
  text: 'a coluna id é a chave primária'
}

const imagePart: ImagePart = {
  kind: 'image',
  hash: 'ghi789',
  fileName: 'grafico.png',
  mimeType: 'image/png'
}

describe('messageText', () => {
  it('joins the text parts in order', () => {
    expect(messageText(message('user', 'uma ', 'frase'))).toBe('uma frase')
  })

  it('returns an empty string for a message with no parts', () => {
    expect(messageText(message('assistant'))).toBe('')
  })

  it('ignores a dataset part — the card is drawn as its own element, not inlined (D16.4 Passo 4)', () => {
    const withAttachment: Message = {
      ...message('user', 'o que tem nesse arquivo?'),
      parts: [datasetPart, { kind: 'text', text: 'o que tem nesse arquivo?' }]
    }

    expect(messageText(withAttachment)).toBe('o que tem nesse arquivo?')
  })
})

describe('attachmentPartOf', () => {
  it('returns null when the message carries no attachment', () => {
    expect(attachmentPartOf(message('user', 'oi'))).toBeNull()
  })

  it('finds a dataset part', () => {
    const withAttachment: Message = {
      ...message('user', 'texto'),
      parts: [datasetPart, { kind: 'text', text: 'texto' }]
    }
    expect(attachmentPartOf(withAttachment)).toEqual(datasetPart)
  })

  it('finds a document part', () => {
    const withAttachment: Message = {
      ...message('user', 'texto'),
      parts: [documentPart, { kind: 'text', text: 'texto' }]
    }
    expect(attachmentPartOf(withAttachment)).toEqual(documentPart)
  })

  it('finds an image part', () => {
    const withAttachment: Message = {
      ...message('user', 'texto'),
      parts: [imagePart, { kind: 'text', text: 'texto' }]
    }
    expect(attachmentPartOf(withAttachment)).toEqual(imagePart)
  })
})

describe('imageCountOf', () => {
  it('returns zero for a history with no image', () => {
    expect(imageCountOf([message('user', 'oi'), message('assistant', 'olá')])).toBe(0)
  })

  it('counts one image part', () => {
    const withImage: Message = {
      ...message('user', 'o que é isso?'),
      parts: [imagePart, { kind: 'text', text: 'o que é isso?' }]
    }

    expect(imageCountOf([withImage])).toBe(1)
  })

  it('sums image parts across several turns', () => {
    const first: Message = {
      ...message('user', 'primeira'),
      parts: [imagePart, { kind: 'text', text: 'primeira' }]
    }
    const second: Message = {
      id: 'm2',
      role: 'user',
      parts: [imagePart, { kind: 'text', text: 'segunda' }],
      createdAt: 1
    }

    expect(imageCountOf([first, message('assistant', 'ok'), second])).toBe(2)
  })
})

describe('toChatMessages', () => {
  it('flattens each message into the provider shape', () => {
    const conversation = [message('user', 'oi'), message('assistant', 'olá')]

    expect(toChatMessages(conversation)).toEqual([
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: 'olá' }
    ])
  })

  it('drops the fields the provider has no place for', () => {
    const withModel: Message = { ...message('assistant', 'r'), model: 'gemma3:4b' }

    // The model is recorded per message for the transcript (D13.4), not sent.
    expect(toChatMessages([withModel])[0]).toEqual({ role: 'assistant', content: 'r' })
  })

  it('materializes a dataset part into the data card text (D16.5)', () => {
    const withAttachment: Message = {
      ...message('user', 'o que tem nesse arquivo?'),
      parts: [datasetPart, { kind: 'text', text: 'o que tem nesse arquivo?' }]
    }

    const [{ content }] = toChatMessages([withAttachment])

    expect(content).toContain('vendas.csv')
    expect(content).toContain('o que tem nesse arquivo?')
  })

  it('materializes a document part verbatim (D17.2)', () => {
    const withAttachment: Message = {
      ...message('user', 'o que diz o documento?'),
      parts: [documentPart, { kind: 'text', text: 'o que diz o documento?' }]
    }

    const [{ content }] = toChatMessages([withAttachment])

    expect(content).toContain('especificacao.md')
    expect(content).toContain('a coluna id é a chave primária')
    expect(content).toContain('o que diz o documento?')
  })

  it('contributes nothing for an image part — it rides on ChatMessage.images instead (D17.5)', () => {
    const withImage: Message = {
      ...message('user', 'o que é isso?'),
      parts: [imagePart, { kind: 'text', text: 'o que é isso?' }]
    }

    expect(toChatMessages([withImage])).toEqual([{ role: 'user', content: 'o que é isso?' }])
  })

  it('filters an empty contribution instead of leaving a dangling separator (D17.5)', () => {
    // The real case this guards: an interrupted or genuinely empty assistant
    // reply, appended today with no guard against an empty `content`.
    const empty: Message = {
      id: 'm1',
      role: 'assistant',
      parts: [{ kind: 'text', text: '' }],
      createdAt: 0
    }

    expect(toChatMessages([empty])).toEqual([{ role: 'assistant', content: '' }])
  })
})

describe('toChatMessagesWithImages', () => {
  it('produces the same content as toChatMessages when no part is an image', async () => {
    const conversation = [message('user', 'oi'), message('assistant', 'olá')]
    const resolveImageBytes = vi.fn()

    const result = await toChatMessagesWithImages(conversation, resolveImageBytes)

    expect(result).toEqual(toChatMessages(conversation))
    expect(resolveImageBytes).not.toHaveBeenCalled()
  })

  it('resolves an image part into base64 bytes on ChatMessage.images', async () => {
    const withImage: Message = {
      ...message('user', 'o que é isso?'),
      parts: [imagePart, { kind: 'text', text: 'o que é isso?' }]
    }
    const resolveImageBytes = vi.fn().mockResolvedValue(Buffer.from('fake png bytes'))

    const result = await toChatMessagesWithImages([withImage], resolveImageBytes)

    expect(resolveImageBytes).toHaveBeenCalledWith('ghi789')
    expect(result).toEqual([
      {
        role: 'user',
        content: 'o que é isso?',
        images: [Buffer.from('fake png bytes').toString('base64')]
      }
    ])
  })

  it('resolves images for the right message in a longer history, iterating messages directly', async () => {
    const history: Message[] = [
      message('user', 'primeiro turno, sem imagem'),
      { ...message('assistant', 'ok'), id: 'm2' },
      {
        id: 'm3',
        role: 'user',
        parts: [imagePart, { kind: 'text', text: 'e essa imagem?' }],
        createdAt: 2
      }
    ]
    const resolveImageBytes = vi.fn().mockResolvedValue(Buffer.from('bytes'))

    const result = await toChatMessagesWithImages(history, resolveImageBytes)

    expect(resolveImageBytes).toHaveBeenCalledTimes(1)
    expect(result[0]).toEqual({ role: 'user', content: 'primeiro turno, sem imagem' })
    expect(result[1]).toEqual({ role: 'assistant', content: 'ok' })
    expect(result[2]).toMatchObject({ role: 'user', content: 'e essa imagem?' })
    expect(result[2]?.images).toHaveLength(1)
  })
})

describe('isCloudService', () => {
  it('treats every non-ollama value as cloud', () => {
    expect(isCloudService('ollama')).toBe(false)
    expect(isCloudService('glm')).toBe(true)
  })
})

describe('checkLevel3', () => {
  it('lets text and dataset parts through on the cloud — only document/image are nível 3', () => {
    const history: Message[] = [
      message('user', 'texto simples'),
      {
        id: 'm2',
        role: 'user',
        parts: [datasetPart, { kind: 'text', text: 'e essa tabela?' }],
        createdAt: 0
      }
    ]
    expect(checkLevel3(history, 'glm')).toBeNull()
  })

  it('blocks a document part on the cloud', () => {
    const history: Message[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [documentPart, { kind: 'text', text: 'resuma' }],
        createdAt: 0
      }
    ]
    const error = checkLevel3(history, 'glm')
    expect(error?.kind).toBe('blocked')
  })

  it('blocks an image part on the cloud', () => {
    const history: Message[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [imagePart, { kind: 'text', text: 'o que é isso?' }],
        createdAt: 0
      }
    ]
    expect(checkLevel3(history, 'glm')?.kind).toBe('blocked')
  })

  it('never blocks on ollama, even with a document or image part', () => {
    const history: Message[] = [
      { id: 'm1', role: 'user', parts: [documentPart, imagePart], createdAt: 0 }
    ]
    expect(checkLevel3(history, 'ollama')).toBeNull()
  })
})
