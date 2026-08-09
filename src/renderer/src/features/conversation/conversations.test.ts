import type { Message } from '@shared/ipc'
import {
  conversationsReducer,
  initialConversationsState,
  DEFAULT_TITLE,
  titleFromText,
  type ConversationsState
} from './conversations'

function userMessage(text: string, createdAt = 1000): Message {
  return { id: `m-${createdAt}`, role: 'user', parts: [{ kind: 'text', text }], createdAt }
}

/** Two conversations, the second one created last and therefore active. */
function twoConversations(): ConversationsState {
  const first = conversationsReducer(initialConversationsState, {
    type: 'create',
    id: 'a',
    now: 1
  })
  return conversationsReducer(first, { type: 'create', id: 'b', now: 2 })
}

describe('conversationsReducer', () => {
  it('creates a conversation, puts it first and makes it active', () => {
    const state = twoConversations()

    expect(state.conversations.map((item) => item.id)).toEqual(['b', 'a'])
    expect(state.activeId).toBe('b')
    expect(state.conversations[0]?.title).toBe(DEFAULT_TITLE)
    expect(state.conversations[0]?.messages).toEqual([])
  })

  it('selects an existing conversation and ignores an unknown id', () => {
    const state = conversationsReducer(twoConversations(), { type: 'select', id: 'a' })
    expect(state.activeId).toBe('a')

    const unchanged = conversationsReducer(state, { type: 'select', id: 'ghost' })
    expect(unchanged).toBe(state)
  })

  it('renames, and falls back to the default rather than leaving a blank row', () => {
    const named = conversationsReducer(twoConversations(), {
      type: 'rename',
      id: 'a',
      title: '  Vendas 2026  '
    })
    expect(named.conversations.find((item) => item.id === 'a')?.title).toBe('Vendas 2026')

    const blanked = conversationsReducer(named, { type: 'rename', id: 'a', title: '   ' })
    expect(blanked.conversations.find((item) => item.id === 'a')?.title).toBe(DEFAULT_TITLE)
  })

  it('elects another conversation when the active one is removed', () => {
    const state = conversationsReducer(twoConversations(), { type: 'remove', id: 'b' })

    expect(state.conversations.map((item) => item.id)).toEqual(['a'])
    expect(state.activeId).toBe('a')
  })

  it('goes back to no active conversation when the last one is removed', () => {
    const one = conversationsReducer(twoConversations(), { type: 'remove', id: 'b' })
    const none = conversationsReducer(one, { type: 'remove', id: 'a' })

    expect(none.conversations).toEqual([])
    expect(none.activeId).toBeNull()
  })

  it('keeps the active conversation when a different one is removed', () => {
    const state = conversationsReducer(twoConversations(), { type: 'remove', id: 'a' })
    expect(state.activeId).toBe('b')
  })

  it('appends a message, titles the conversation from it, and moves it to the front', () => {
    const state = conversationsReducer(twoConversations(), {
      type: 'append',
      id: 'a',
      message: userMessage('quantas linhas tem o arquivo?', 5000)
    })

    const first = state.conversations[0]
    expect(first?.id).toBe('a')
    expect(first?.title).toBe('quantas linhas tem o arquivo?')
    expect(first?.updatedAt).toBe(5000)
    expect(first?.messages).toHaveLength(1)
  })

  it('titles from the first user message only, never from later ones', () => {
    const firstTurn = conversationsReducer(twoConversations(), {
      type: 'append',
      id: 'a',
      message: userMessage('primeira')
    })
    const answered = conversationsReducer(firstTurn, {
      type: 'append',
      id: 'a',
      message: {
        id: 'm2',
        role: 'assistant',
        parts: [{ kind: 'text', text: 'resposta' }],
        createdAt: 2000,
        model: 'gemma3:4b'
      }
    })
    const secondTurn = conversationsReducer(answered, {
      type: 'append',
      id: 'a',
      message: userMessage('segunda', 3000)
    })

    expect(secondTurn.conversations[0]?.title).toBe('primeira')
  })

  it('leaves the title alone when the assistant speaks first', () => {
    const state = conversationsReducer(twoConversations(), {
      type: 'append',
      id: 'a',
      message: {
        id: 'm1',
        role: 'assistant',
        parts: [{ kind: 'text', text: 'olá' }],
        createdAt: 1
      }
    })

    expect(state.conversations[0]?.title).toBe(DEFAULT_TITLE)
  })

  it('ignores an append to an unknown conversation', () => {
    const state = twoConversations()
    expect(
      conversationsReducer(state, { type: 'append', id: 'ghost', message: userMessage('x') })
    ).toBe(state)
  })
})

describe('titleFromText', () => {
  it('collapses whitespace and keeps a short message whole', () => {
    expect(titleFromText('  duas   linhas\ne mais  ')).toBe('duas linhas e mais')
  })

  it('truncates a long message with an ellipsis', () => {
    const title = titleFromText('a'.repeat(80))
    expect(title).toHaveLength(48)
    expect(title.endsWith('…')).toBe(true)
  })

  it('falls back to the default for an empty message', () => {
    expect(titleFromText('   ')).toBe(DEFAULT_TITLE)
  })
})
