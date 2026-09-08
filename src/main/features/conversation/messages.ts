import type { DatabaseSync } from 'node:sqlite'
import type { Args, Message } from '@shared/ipc'
import { inTransaction } from '../../db/transaction'
import { toMessage } from './rows'

// The message-level half of the conversation handlers — reading a transcript,
// appending to it, deleting one message, switching one part out of the resend.
// Split from handlers.ts in 23-C, when setDocsEnabled pushed that file past the
// 150-line ceiling; the seam is the row each one addresses, and both halves
// keep taking the database by parameter (DIP), callable against ':memory:'.

export function readMessages(
  { conversationId }: Args<'conversation:messages'>,
  db: DatabaseSync
): Message[] {
  return db
    .prepare(
      `SELECT id, role, parts, created_at, model, stopped, prompt_tokens, eval_tokens FROM messages
       WHERE conversation_id = ? ORDER BY created_at, id`
    )
    .all(conversationId)
    .map(toMessage)
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

// The JSON path pieces travel as bound parameters, so no part of the statement
// is built by string concatenation with caller data.
const DOCS_ID_PATH = '$.id'
const PARTS_INDEX_PREFIX = '$['
const ENABLED_SUFFIX = '].enabled'

/**
 * Switches one Context7 consultation in or out of the resend (DM-31), leaving
 * it in the transcript either way.
 *
 * @param enabled - The new value; everything else in `parts` is untouched.
 */
export function setDocsEnabled(
  { conversationId, messageId, docsId, enabled }: Args<'conversation:setDocsEnabled'>,
  db: DatabaseSync
): void {
  // json_set edits the one path in a single statement, the same reasoning
  // updateConversationSettings writes down for json_patch — no read-modify-write
  // window, and the rest of the blob is preserved byte for byte (measured
  // against the Electron binary: code with newlines, backslashes, quotes and
  // non-ASCII survives untouched).
  //
  // An id that is not in this message is a no-op, and by SQLite's own doing:
  // the subquery yields NULL, the concatenated path becomes NULL, and json_set
  // given a NULL path returns the document UNCHANGED instead of failing. That
  // is measured, not assumed (D23C.7) — an EXISTS guard was written here first
  // and removed for changing nothing a caller can observe, since the handler
  // returns void and never reads `changes`.
  db.prepare(
    `UPDATE messages
        SET parts = json_set(
              parts,
              ?4 || (SELECT key FROM json_each(messages.parts) WHERE value ->> ?6 = ?3) || ?5,
              json(?7)
            )
      WHERE id = ?2
        AND conversation_id = ?1`
  ).run(
    conversationId,
    messageId,
    docsId,
    PARTS_INDEX_PREFIX,
    ENABLED_SUFFIX,
    DOCS_ID_PATH,
    enabled ? 'true' : 'false'
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
      `INSERT INTO messages (id, conversation_id, role, parts, created_at, model, stopped, prompt_tokens, eval_tokens)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      message.id,
      conversationId,
      message.role,
      JSON.stringify(message.parts),
      message.createdAt,
      message.model ?? null,
      message.stopped ?? null,
      message.promptTokens ?? null,
      message.evalTokens ?? null
    )
  })
}
