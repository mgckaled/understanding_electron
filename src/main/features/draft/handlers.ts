import type { DatabaseSync } from 'node:sqlite'
import type { Args, Draft } from '@shared/ipc'
import { toDraft } from './rows'

// Drafts are the trilha-E object: an answer the user pulled out of the
// transcript to work on. Every handler takes the database as a parameter (DIP),
// like the conversation block, so all three are level-3 testable against
// ':memory:'. None returns Result (DE1A.5).

export function listDrafts({ conversationId }: Args<'draft:list'>, db: DatabaseSync): Draft[] {
  return db
    .prepare(
      `SELECT id, conversation_id, source_message_id, title, content, created_at, updated_at
       FROM drafts WHERE conversation_id = ? ORDER BY created_at, id`
    )
    .all(conversationId)
    .map(toDraft)
}

export function createDraft(
  { id, conversationId, sourceMessageId, title, content, createdAt }: Args<'draft:create'>,
  db: DatabaseSync
): void {
  // updated_at starts equal to created_at: nothing has edited it yet, and the
  // column has to be sortable from the first insert.
  db.prepare(
    `INSERT INTO drafts
       (id, conversation_id, source_message_id, title, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, conversationId, sourceMessageId, title, content, createdAt, createdAt)
}

export function updateDraft(
  { id, title, content, updatedAt }: Args<'draft:update'>,
  db: DatabaseSync
): void {
  db.prepare('UPDATE drafts SET title = ?, content = ?, updated_at = ? WHERE id = ?').run(
    title,
    content,
    updatedAt,
    id
  )
}

export function removeDraft({ id }: Args<'draft:remove'>, db: DatabaseSync): void {
  db.prepare('DELETE FROM drafts WHERE id = ?').run(id)
}
