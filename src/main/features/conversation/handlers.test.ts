import type { DatabaseSync } from 'node:sqlite'
import type { Message } from '@shared/ipc'
import { openDatabase } from '../../db/open'
import {
  appendMessage,
  createConversation,
  listConversations,
  readMessages,
  removeConversation,
  renameConversation
} from './handlers'

/*
 * Level 3: every handler is a plain exported function taking the database as a
 * parameter, so all of this runs in pure Node against ':memory:' — no Electron,
 * no mock of it. That property is the one that pays the most in the typed
 * contract, and it is why none of these is written as a closure in the registry.
 */

let db: DatabaseSync

beforeEach(() => {
  db = openDatabase(':memory:')
})

afterEach(() => {
  db.close()
})

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    role: 'user',
    parts: [{ kind: 'text', text: 'oi' }],
    createdAt: 2000,
    ...overrides
  }
}

describe('listConversations', () => {
  it('returns nothing on a fresh database', () => {
    expect(listConversations(undefined, db)).toEqual([])
  })

  it('orders by updated_at descending — the sidebar order', () => {
    createConversation({ id: 'old', title: 'Antiga', createdAt: 1000 }, db)
    createConversation({ id: 'new', title: 'Nova', createdAt: 3000 }, db)

    expect(listConversations(undefined, db).map((item) => item.id)).toEqual(['new', 'old'])
  })

  it('brings a touched conversation back to the top', () => {
    createConversation({ id: 'old', title: 'Antiga', createdAt: 1000 }, db)
    createConversation({ id: 'new', title: 'Nova', createdAt: 3000 }, db)

    appendMessage({ conversationId: 'old', message: message({ createdAt: 5000 }) }, db)

    // This is the invariant the fase-13 store already mirrored, which is what
    // lets the UI keep its behaviour when the source changes underneath it.
    expect(listConversations(undefined, db).map((item) => item.id)).toEqual(['old', 'new'])
  })
})

describe('createConversation', () => {
  it('inserts the identity and timestamp exactly as received (D14.5)', () => {
    createConversation({ id: 'c1', title: 'Nova conversa', createdAt: 1234 }, db)

    const [conversation] = listConversations(undefined, db)
    expect(conversation).toEqual({
      id: 'c1',
      title: 'Nova conversa',
      createdAt: 1234,
      updatedAt: 1234
    })
  })
})

describe('renameConversation', () => {
  it('changes the title without counting as activity', () => {
    createConversation({ id: 'c1', title: 'Nova conversa', createdAt: 1000 }, db)

    renameConversation({ id: 'c1', title: 'Vendas' }, db)

    const [conversation] = listConversations(undefined, db)
    expect(conversation.title).toBe('Vendas')
    // Fixing a typo in a title must not jump an old conversation to the top.
    expect(conversation.updatedAt).toBe(1000)
  })
})

describe('appendMessage', () => {
  beforeEach(() => {
    createConversation({ id: 'c1', title: 'Nova conversa', createdAt: 1000 }, db)
  })

  it('round-trips the typed parts through the JSON column', () => {
    appendMessage({ conversationId: 'c1', message: message({ model: 'gemma3:4b' }) }, db)

    expect(readMessages({ conversationId: 'c1' }, db)).toEqual([
      {
        id: 'm1',
        role: 'user',
        parts: [{ kind: 'text', text: 'oi' }],
        createdAt: 2000,
        model: 'gemma3:4b'
      }
    ])
  })

  it('round-trips the stopped marker of an interrupted reply', () => {
    appendMessage(
      {
        conversationId: 'c1',
        message: message({ role: 'assistant', stopped: 'timeout', model: 'gemma3:4b' })
      },
      db
    )

    expect(readMessages({ conversationId: 'c1' }, db)[0]).toMatchObject({ stopped: 'timeout' })
  })

  it('omits stopped entirely when the reply finished', () => {
    appendMessage({ conversationId: 'c1', message: message({ role: 'assistant' }) }, db)

    expect(readMessages({ conversationId: 'c1' }, db)[0]).not.toHaveProperty('stopped')
  })

  it('omits model entirely when the message carries none', () => {
    appendMessage({ conversationId: 'c1', message: message() }, db)

    // NULL must come back as an absent key, not as `model: null` — the contract
    // says `model?: string`, and a null would typecheck nowhere and render
    // as the string "null" somewhere.
    expect(readMessages({ conversationId: 'c1' }, db)[0]).not.toHaveProperty('model')
  })

  it('applies the title when one is sent, and keeps it when none is', () => {
    appendMessage({ conversationId: 'c1', message: message(), title: 'Quantas linhas?' }, db)
    appendMessage(
      { conversationId: 'c1', message: message({ id: 'm2', role: 'assistant', createdAt: 3000 }) },
      db
    )

    expect(listConversations(undefined, db)[0]).toMatchObject({
      title: 'Quantas linhas?',
      updatedAt: 3000
    })
  })

  it('returns the transcript oldest first', () => {
    appendMessage({ conversationId: 'c1', message: message({ id: 'm2', createdAt: 3000 }) }, db)
    appendMessage({ conversationId: 'c1', message: message({ id: 'm1', createdAt: 2000 }) }, db)

    expect(readMessages({ conversationId: 'c1' }, db).map((item) => item.id)).toEqual(['m1', 'm2'])
  })

  it('drops a message addressed to a conversation that no longer exists', () => {
    removeConversation({ id: 'c1' }, db)

    // The real race: a long reply is cancelled and the partial is written after
    // the user already deleted the conversation. Nothing about that is a
    // programming defect, so it must not throw — it has nowhere to live.
    expect(() => appendMessage({ conversationId: 'c1', message: message() }, db)).not.toThrow()
    expect(readMessages({ conversationId: 'c1' }, db)).toEqual([])
  })
})

describe('removeConversation', () => {
  it('takes the messages with it', () => {
    createConversation({ id: 'c1', title: 'Nova conversa', createdAt: 1000 }, db)
    appendMessage({ conversationId: 'c1', message: message() }, db)

    removeConversation({ id: 'c1' }, db)

    expect(listConversations(undefined, db)).toEqual([])
    expect(readMessages({ conversationId: 'c1' }, db)).toEqual([])
  })

  it('is a no-op for an id that is not there', () => {
    expect(() => removeConversation({ id: 'ghost' }, db)).not.toThrow()
  })
})
