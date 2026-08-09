import type { Message } from '@shared/ipc'
import { messageText, toChatMessages } from './messages'

function message(role: Message['role'], ...texts: string[]): Message {
  return {
    id: `m-${role}-${texts.join('')}`,
    role,
    parts: texts.map((text) => ({ kind: 'text', text })),
    createdAt: 0
  }
}

describe('messageText', () => {
  it('joins the text parts in order', () => {
    expect(messageText(message('user', 'uma ', 'frase'))).toBe('uma frase')
  })

  it('returns an empty string for a message with no parts', () => {
    expect(messageText(message('assistant'))).toBe('')
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
})
