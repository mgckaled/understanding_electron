import type { Conversation, Message } from '@shared/ipc'
import { messageText } from '@core/ai/messages'

/*
 * Client state for conversations: the reducer, kept pure and free of React.
 *
 * The division that holds for the whole arc (D13.2): CLIENT state — which
 * conversation is active, whether the sidebar is collapsed, the draft, the
 * jobId in flight — stays here for good; SERVER cache — the list itself, the
 * messages — migrates to TanStack Query in plano 14. A client store holding
 * server data that goes stale with nobody knowing is the mistake that produces
 * a rewrite.
 *
 * Every action carries its own `id` and `now`. Generating them inside the
 * reducer would make it impure, and React 19 invokes reducers twice under
 * StrictMode in development precisely to surface that — two different UUIDs
 * per dispatch, a defect visible only in dev and only sometimes.
 */

export const DEFAULT_TITLE = 'Nova conversa'
const TITLE_MAX = 48

/**
 * A conversation together with its transcript.
 *
 * `Conversation` in the contract is the ROW (D14.1) — the sidebar lists rows,
 * and the transcript is a second read. This composite is how the renderer puts
 * the two back together for the conversation on screen, and it lives here and
 * not in `shared/` for the same reason `ViewState` does: main has no opinion
 * about it.
 */
export type ConversationWithMessages = Conversation & { messages: Message[] }

export type ConversationsState = {
  conversations: ConversationWithMessages[]
  activeId: string | null
}

export type ConversationsAction =
  | { type: 'create'; id: string; now: number }
  | { type: 'select'; id: string }
  | { type: 'rename'; id: string; title: string }
  | { type: 'remove'; id: string }
  | { type: 'append'; id: string; message: Message }

export const initialConversationsState: ConversationsState = {
  conversations: [],
  activeId: null
}

/**
 * The title of a conversation is its first user message, truncated (D13.9).
 * Free and instant, and it is what the user just wrote — the alternative of
 * asking the model for a title costs a round trip at 4–6 tok/s that competes
 * with the answer the user is waiting for. Not discarded, just expensive; the
 * trigger to reopen it is a cloud provider being in use.
 */
export function titleFromText(text: string): string {
  const normalised = text.replace(/\s+/g, ' ').trim()
  if (normalised === '') return DEFAULT_TITLE
  return normalised.length <= TITLE_MAX ? normalised : `${normalised.slice(0, TITLE_MAX - 1)}…`
}

/** Newest first, mirroring the `ORDER BY updated_at DESC` plano 14 will run. */
function moveToFront(
  conversations: ConversationWithMessages[],
  updated: ConversationWithMessages
): ConversationWithMessages[] {
  return [updated, ...conversations.filter((item) => item.id !== updated.id)]
}

export function conversationsReducer(
  state: ConversationsState,
  action: ConversationsAction
): ConversationsState {
  switch (action.type) {
    case 'create': {
      const conversation: ConversationWithMessages = {
        id: action.id,
        title: DEFAULT_TITLE,
        messages: [],
        createdAt: action.now,
        updatedAt: action.now
      }
      return { conversations: [conversation, ...state.conversations], activeId: action.id }
    }

    case 'select': {
      const exists = state.conversations.some((item) => item.id === action.id)
      return exists ? { ...state, activeId: action.id } : state
    }

    case 'rename': {
      const target = state.conversations.find((item) => item.id === action.id)
      if (!target) return state
      // An empty rename falls back to the default rather than leaving a blank
      // row in the sidebar — nothing to click and nothing to read.
      const title = action.title.trim() === '' ? DEFAULT_TITLE : action.title.trim()
      return {
        ...state,
        conversations: state.conversations.map((item) =>
          item.id === action.id ? { ...item, title } : item
        )
      }
    }

    case 'remove': {
      const conversations = state.conversations.filter((item) => item.id !== action.id)
      if (conversations.length === state.conversations.length) return state
      // Removing the active one has to elect another or go back to none. Left
      // dangling, activeId points at something that no longer exists and the
      // view renders blank with no error anywhere.
      const activeId =
        state.activeId === action.id ? (conversations[0]?.id ?? null) : state.activeId
      return { conversations, activeId }
    }

    case 'append': {
      const target = state.conversations.find((item) => item.id === action.id)
      if (!target) return state
      const isFirstUserMessage = target.title === DEFAULT_TITLE && action.message.role === 'user'
      const updated: ConversationWithMessages = {
        ...target,
        messages: [...target.messages, action.message],
        title: isFirstUserMessage ? titleFromText(messageText(action.message)) : target.title,
        updatedAt: action.message.createdAt
      }
      return { ...state, conversations: moveToFront(state.conversations, updated) }
    }
  }
}
