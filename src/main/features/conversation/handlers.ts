import type { DatabaseSync } from 'node:sqlite'
import type { Args, Conversation, Message } from '@shared/ipc'
import { inTransaction } from '../../db/transaction'
import { toConversation, toMessage } from './rows'

// Conversations are the app's first data of its own (ESCOPO.md). Every handler
// takes the database as a parameter (DIP), so all are callable as plain
// functions against ':memory:' in a level-3 test — no Electron, no mock; only
// ipc/register-all.ts knows where the file lives.

export function listConversations(_args: void, db: DatabaseSync): Conversation[] {
  // `settings` rides along (D15.6): it is a couple of hundred bytes already in
  // the row, and the active conversation needs the model before it can send
  // anything. A separate read would be a second trip for data that arrived.
  return db
    .prepare(
      `SELECT id, title, created_at, updated_at, settings FROM conversations
       ORDER BY updated_at DESC`
    )
    .all()
    .map(toConversation)
}

export function readMessages(
  { conversationId }: Args<'conversation:messages'>,
  db: DatabaseSync
): Message[] {
  return db
    .prepare(
      `SELECT id, role, parts, created_at, model, stopped FROM messages
       WHERE conversation_id = ? ORDER BY created_at, id`
    )
    .all(conversationId)
    .map(toMessage)
}

export function createConversation(
  { id, title, createdAt }: Args<'conversation:create'>,
  db: DatabaseSync
): void {
  // updated_at starts equal to created_at so a conversation with no messages
  // still sorts sensibly in the sidebar — it was just created, so it is newest.
  db.prepare(
    'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).run(id, title, createdAt, createdAt)
}

export function renameConversation(
  { id, title }: Args<'conversation:rename'>,
  db: DatabaseSync
): void {
  // Renaming is not activity: `updated_at` is deliberately left alone, so
  // fixing a typo in a title does not jump an old conversation to the top.
  db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, id)
}

export function removeConversation({ id }: Args<'conversation:remove'>, db: DatabaseSync): void {
  // The messages go with it through ON DELETE CASCADE. That works because a
  // message belongs to one conversation and no other — an attachment blob in
  // userData/attachments/<hash> is the opposite (shared between conversations),
  // and plano 16 cannot reuse this cascade for it.
  db.prepare('DELETE FROM conversations WHERE id = ?').run(id)
}

export function removeMessage(
  { conversationId, messageId }: Args<'conversation:removeMessage'>,
  db: DatabaseSync
): void {
  // Same "absence is data" reasoning as appendMessage's dropped-race case — a
  // message already gone (double click, stale card) touches zero rows, not an error.
  db.prepare('DELETE FROM messages WHERE id = ? AND conversation_id = ?').run(
    messageId,
    conversationId
  )
}

export function updateConversationSettings(
  { id, patch }: Args<'conversation:settings'>,
  db: DatabaseSync
): void {
  // json_patch merges in one statement, so two controls writing settings cannot
  // clobber each other through a read-modify-write window; a null value removes
  // its key (RFC 7386), how a setting returns to the app default. An unknown id
  // touches zero rows and is dropped, like appendMessage: settings for a
  // just-deleted conversation is a race, not a defect.
  db.prepare('UPDATE conversations SET settings = json_patch(settings, ?) WHERE id = ?').run(
    JSON.stringify(patch),
    id
  )
}

export function appendMessage(
  { conversationId, message, title }: Args<'conversation:append'>,
  db: DatabaseSync
): void {
  inTransaction(db, () => {
    const touched = db
      .prepare('UPDATE conversations SET updated_at = ?, title = COALESCE(?, title) WHERE id = ?')
      .run(message.createdAt, title ?? null, conversationId)

    // A reply can land after its conversation was deleted (cancel + remove while
    // the partial is on its way). It is dropped, not a foreign-key error —
    // nothing here is a defect — detected by the UPDATE's own row count.
    if (Number(touched.changes) === 0) return

    db.prepare(
      `INSERT INTO messages (id, conversation_id, role, parts, created_at, model, stopped)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      message.id,
      conversationId,
      message.role,
      JSON.stringify(message.parts),
      message.createdAt,
      message.model ?? null,
      message.stopped ?? null
    )
  })
}
