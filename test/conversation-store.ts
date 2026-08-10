import { vi } from 'vitest'
import type { Api } from '@shared/ipc'
import { openDatabase } from '../src/main/db/open'
import {
  appendMessage,
  createConversation,
  listConversations,
  readMessages,
  removeConversation,
  renameConversation
} from '../src/main/features/conversation/handlers'

/**
 * The conversation half of the api mock, backed by the REAL handlers against an
 * in-memory database.
 *
 * The alternative was a hand-written fake, and it was rejected for the same
 * reason `satisfies Api` exists: a fake would have to re-implement ordering by
 * updated_at, the COALESCE that applies a title, and the cascade — forty lines
 * that can drift from the handlers without anything noticing. Deriving instead
 * of duplicating means a level-2 test that passes here is exercising the
 * storage rule the app actually ships.
 *
 * What this is NOT: it does not boot Electron, and no IPC is involved. The
 * handlers are plain functions taking the database as a parameter (DIP), which
 * is precisely the property that makes this possible.
 *
 * Each call gets its own database, so tests stay isolated with no reset step.
 */
export function createConversationApi(): Api['conversation'] {
  const db = openDatabase(':memory:')

  return {
    list: vi.fn(async () => listConversations(undefined, db)),
    messages: vi.fn(async (conversationId: string) => readMessages({ conversationId }, db)),
    create: vi.fn(async (conversation) => createConversation(conversation, db)),
    rename: vi.fn(async (id: string, title: string) => renameConversation({ id, title }, db)),
    remove: vi.fn(async (id: string) => removeConversation({ id }, db)),
    append: vi.fn(async (conversationId, message, title) =>
      appendMessage({ conversationId, message, ...(title === undefined ? {} : { title }) }, db)
    )
  }
}
