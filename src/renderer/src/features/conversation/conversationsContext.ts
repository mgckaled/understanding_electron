import { createContext, useContext, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Conversation, ConversationSettings, Message } from '@shared/ipc'
import { messageText } from '@core/ai/messages'
import { DEFAULT_TITLE, titleFromText, type ConversationWithMessages } from './conversations'

// SERVER cache (list, transcript) lives in TanStack Query; CLIENT state (which
// conversation is selected) in Context. These two hooks are the ONLY place
// either is touched — no component calls useContext or useQueryClient (D14.4).

const CONVERSATIONS_KEY = ['conversations'] as const
const messagesKey = (conversationId: string): readonly unknown[] => [
  'conversations',
  conversationId,
  'messages'
]

/** Stable identity, so an empty list does not re-run every downstream memo. */
const NO_CONVERSATIONS: Conversation[] = []

type ConversationsContextValue = {
  selectedId: string | null
  setSelectedId: (id: string | null) => void
}

export const ConversationsContext = createContext<ConversationsContextValue | null>(null)

/** A message before the renderer stamps it with an identity and a timestamp. */
export type NewMessage = Omit<Message, 'id' | 'createdAt'>

export type ConversationsApi = {
  conversations: Conversation[]
  activeId: string | null
  /** Creates an empty conversation, selects it, and returns its id. */
  create: () => string
  select: (id: string) => void
  rename: (id: string, title: string) => void
  remove: (id: string) => void
  append: (id: string, message: NewMessage) => void
  /** Merge-patches one conversation's settings — model, num_ctx (D15.2). */
  updateSettings: (id: string, patch: ConversationSettings) => void
}

function useConversationsContext(): ConversationsContextValue {
  const value = useContext(ConversationsContext)
  if (value === null) {
    throw new Error('useConversations must be called inside <ConversationsProvider>.')
  }
  return value
}

export function useConversations(): ConversationsApi {
  const { selectedId, setSelectedId } = useConversationsContext()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: () => window.api.conversation.list()
  })
  const conversations = data ?? NO_CONVERSATIONS

  // Every write shares one scope, so they run in SERIES: without it "create a
  // conversation" and "append the first message" race, and the append can reach
  // the DB first, dropped for having no conversation to belong to.
  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
  const scope = { id: 'conversations' }
  const create = useMutation({
    scope,
    mutationFn: window.api.conversation.create,
    onSuccess: invalidate
  })
  const rename = useMutation({
    scope,
    mutationFn: (args: { id: string; title: string }) =>
      window.api.conversation.rename(args.id, args.title),
    onSuccess: invalidate
  })
  const remove = useMutation({
    scope,
    mutationFn: (id: string) => window.api.conversation.remove(id),
    onSuccess: invalidate
  })
  const append = useMutation({
    scope,
    mutationFn: (args: { id: string; message: Message; title?: string }) =>
      window.api.conversation.append(args.id, args.message, args.title),
    onSuccess: invalidate
  })
  // Same scope, for a concrete reason: picking a model and sending the first
  // message are two writes to the same row, and send reads `settings` back.
  // Serialised, the order is the one the user performed.
  const updateSettings = useMutation({
    scope,
    mutationFn: (args: { id: string; patch: ConversationSettings }) =>
      window.api.conversation.updateSettings(args.id, args.patch),
    onSuccess: invalidate
  })

  // On first open, the most recent conversation (D14.6): the list arrives ORDER
  // BY updated_at DESC, so `[0]` IS that one. An empty database opens with no
  // active conversation, the empty state ConversationView already draws.
  const activeId = selectedId ?? conversations[0]?.id ?? null

  return useMemo(
    () => ({
      conversations,
      activeId,
      create: () => {
        const id = crypto.randomUUID()
        create.mutate({ id, title: DEFAULT_TITLE, createdAt: Date.now() })
        setSelectedId(id)
        return id
      },
      select: setSelectedId,
      rename: (id: string, title: string) => {
        // An empty rename falls back to the default rather than leaving a blank
        // row in the sidebar — nothing to click and nothing to read.
        rename.mutate({ id, title: title.trim() === '' ? DEFAULT_TITLE : title.trim() })
      },
      remove: (id: string) => {
        remove.mutate(id)
        // Going back to no selection re-elects the newest remaining one through
        // the derivation above, instead of pointing at something that is gone.
        if (selectedId === id) setSelectedId(null)
      },
      append: (id: string, message: NewMessage) => {
        const full: Message = { ...message, id: crypto.randomUUID(), createdAt: Date.now() }
        // A conversation not in the list yet was just created, so it still
        // carries the default title — hence `?? DEFAULT_TITLE`, not `?? ''`.
        // Wrong, it loses the title of the first turn, the only one that sets it (D13.9).
        const current = conversations.find((item) => item.id === id)?.title ?? DEFAULT_TITLE
        const renames = current === DEFAULT_TITLE && message.role === 'user'
        append.mutate({
          id,
          message: full,
          ...(renames ? { title: titleFromText(messageText(full)) } : {})
        })
      },
      updateSettings: (id: string, patch: ConversationSettings) => {
        updateSettings.mutate({ id, patch })
      }
    }),
    [
      conversations,
      activeId,
      selectedId,
      setSelectedId,
      create,
      rename,
      remove,
      append,
      updateSettings
    ]
  )
}

export function useActiveConversation(): ConversationWithMessages | null {
  const { conversations, activeId } = useConversations()

  const { data } = useQuery({
    queryKey: messagesKey(activeId ?? ''),
    queryFn: () => window.api.conversation.messages(activeId as string),
    enabled: activeId !== null
  })

  const conversation = conversations.find((item) => item.id === activeId)
  if (conversation === undefined) return null
  // `messagesLoaded` only works because no `placeholderData` is set: with one,
  // `data` survives a queryKey change and a switched-to conversation would read
  // as loaded with the previous transcript, unlocking the pair (D15.13).
  return { ...conversation, messages: data ?? [], messagesLoaded: data !== undefined }
}
