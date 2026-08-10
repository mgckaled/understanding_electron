import type { DatabaseSync } from 'node:sqlite'
import type { Args, Conversation, Message } from '@shared/ipc'
import { inTransaction } from '../../db/transaction'
import { toConversation, toMessage } from './rows'

/*
 * Conversations are the application's first data of its own (ESCOPO.md):
 * everything until here is derived from a file the user owns, and a
 * conversation is not.
 *
 * Every handler takes the database as a parameter (DIP), which is what makes
 * all of them callable as plain functions against ':memory:' in a level-3 test
 * — no Electron, no mock. The composition root in ipc/register-all.ts is the
 * only place that knows where the file lives.
 */

export function listConversations(_args: void, db: DatabaseSync): Conversation[] {
  return db
    .prepare('SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC')
    .all()
    .map(toConversation)
}

export function readMessages(
  { conversationId }: Args<'conversation:messages'>,
  db: DatabaseSync
): Message[] {
  return db
    .prepare(
      `SELECT id, role, parts, created_at, model FROM messages
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

export function appendMessage(
  { conversationId, message, title }: Args<'conversation:append'>,
  db: DatabaseSync
): void {
  inTransaction(db, () => {
    const touched = db
      .prepare('UPDATE conversations SET updated_at = ?, title = COALESCE(?, title) WHERE id = ?')
      .run(message.createdAt, title ?? null, conversationId)

    // A reply can land after its conversation was deleted — the user cancels a
    // long answer and removes the conversation while the partial is on its way.
    // The message has nowhere to live, so it is dropped instead of raising a
    // foreign-key error: nothing about it is a programming defect. Detected by
    // the UPDATE's own row count, which costs no extra query.
    if (Number(touched.changes) === 0) return

    db.prepare(
      `INSERT INTO messages (id, conversation_id, role, parts, created_at, model)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      message.id,
      conversationId,
      message.role,
      JSON.stringify(message.parts),
      message.createdAt,
      message.model ?? null
    )
  })
}
