import type { DatabaseSync } from 'node:sqlite'
import type { Args, Conversation } from '@shared/ipc'
import { toConversation } from './rows'

// Conversations are the app's first data of its own (ESCOPO.md). Every handler
// takes the database as a parameter (DIP), so all are callable as plain
// functions against ':memory:' in a level-3 test — no Electron, no mock; only
// ipc/register-all.ts knows where the file lives.
//
// This half addresses the conversation row; the message row is messages.ts.

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
