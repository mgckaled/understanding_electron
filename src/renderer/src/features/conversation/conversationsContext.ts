import { createContext, useContext, useMemo, type Dispatch } from 'react'
import type { Message } from '@shared/ipc'
import type {
  ConversationsAction,
  ConversationsState,
  ConversationWithMessages
} from './conversations'

/*
 * Context behind purpose-shaped hooks (D13.2). No component calls useContext
 * directly, and that is the whole point: when plano 14 replaces the in-memory
 * list with a server cache, the body of these two hooks is the only thing that
 * changes — one file, not four. Props would have been honest (the tree is two
 * levels deep, there is no drilling) but they get rewritten anyway.
 */

type ConversationsContextValue = {
  state: ConversationsState
  dispatch: Dispatch<ConversationsAction>
}

export const ConversationsContext = createContext<ConversationsContextValue | null>(null)

/** A message before the store stamps it with an identity and a timestamp. */
export type NewMessage = Omit<Message, 'id' | 'createdAt'>

export type ConversationsApi = {
  conversations: ConversationWithMessages[]
  activeId: string | null
  /** Creates an empty conversation, selects it, and returns its id. */
  create: () => string
  select: (id: string) => void
  rename: (id: string, title: string) => void
  remove: (id: string) => void
  append: (id: string, message: NewMessage) => void
}

function useConversationsContext(): ConversationsContextValue {
  const value = useContext(ConversationsContext)
  if (value === null) {
    throw new Error('useConversations must be called inside <ConversationsProvider>.')
  }
  return value
}

export function useConversations(): ConversationsApi {
  const { state, dispatch } = useConversationsContext()

  // dispatch is stable, so this memo only re-runs when the data actually
  // changes — the identity of the action creators stays put across a stream of
  // tokens re-rendering the view.
  return useMemo(
    () => ({
      conversations: state.conversations,
      activeId: state.activeId,
      create: () => {
        const id = crypto.randomUUID()
        dispatch({ type: 'create', id, now: Date.now() })
        return id
      },
      select: (id: string) => dispatch({ type: 'select', id }),
      rename: (id: string, title: string) => dispatch({ type: 'rename', id, title }),
      remove: (id: string) => dispatch({ type: 'remove', id }),
      append: (id: string, message: NewMessage) =>
        dispatch({
          type: 'append',
          id,
          // Identity and timestamp are minted here, never inside the reducer:
          // a reducer that calls randomUUID() is impure, and StrictMode's
          // double invocation in development turns that into two ids.
          message: { ...message, id: crypto.randomUUID(), createdAt: Date.now() }
        })
    }),
    [state.conversations, state.activeId, dispatch]
  )
}

export function useActiveConversation(): ConversationWithMessages | null {
  const { state } = useConversationsContext()
  return state.conversations.find((item) => item.id === state.activeId) ?? null
}
