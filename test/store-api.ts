import { vi } from 'vitest'
import type { Api } from '@shared/ipc'
import { openDatabase } from '../src/main/db/open'
import {
  appendMessage,
  createConversation,
  listConversations,
  readMessages,
  removeConversation,
  removeMessage,
  renameConversation,
  updateConversationSettings
} from '../src/main/features/conversation/handlers'
import { readSettings, writeSettings } from '../src/main/features/settings/handlers'

/**
 * The stored half of the api mock — conversations and machine settings — backed
 * by the REAL handlers against one in-memory database, exactly as in production
 * (D14.7: one storage mechanism, one ladder).
 *
 * The alternative was a hand-written fake, and it was rejected for the same
 * reason `satisfies Api` exists: a fake would have to re-implement ordering by
 * updated_at, the COALESCE that applies a title, the cascade and the settings
 * merge — lines that can drift from the handlers without anything noticing.
 * Deriving instead of duplicating means a level-2 test that passes here is
 * exercising the storage rule the app actually ships.
 *
 * What this is NOT: it does not boot Electron, and no IPC is involved. The
 * handlers are plain functions taking the database as a parameter (DIP), which
 * is precisely the property that makes this possible.
 *
 * Each call gets its own database, so tests stay isolated with no reset step.
 */
export function createStoreApi(): Pick<Api, 'conversation' | 'settings'> {
  const db = openDatabase(':memory:')

  return {
    conversation: {
      list: vi.fn(async () => listConversations(undefined, db)),
      messages: vi.fn(async (conversationId: string) => readMessages({ conversationId }, db)),
      create: vi.fn(async (conversation) => createConversation(conversation, db)),
      rename: vi.fn(async (id: string, title: string) => renameConversation({ id, title }, db)),
      remove: vi.fn(async (id: string) => removeConversation({ id }, db)),
      removeMessage: vi.fn(async (conversationId: string, messageId: string) =>
        removeMessage({ conversationId, messageId }, db)
      ),
      append: vi.fn(async (conversationId, message, title) =>
        appendMessage({ conversationId, message, ...(title === undefined ? {} : { title }) }, db)
      ),
      updateSettings: vi.fn(async (id, patch) => updateConversationSettings({ id, patch }, db))
    },
    settings: {
      read: vi.fn(async () => readSettings(undefined, db)),
      write: vi.fn(async (patch) => writeSettings(patch, db))
    }
  }
}
