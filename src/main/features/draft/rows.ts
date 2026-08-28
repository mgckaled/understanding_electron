import type { Draft } from '@shared/ipc'

// Same edge as conversation/rows.ts: node:sqlite hands back a loose Record, so
// the typing is rebuilt here rather than cast in each handler. No zod — main
// wrote these rows, and a draft has no schemaless blob to migrate.

export function toDraft(row: Record<string, unknown>): Draft {
  return {
    id: String(row['id']),
    conversationId: String(row['conversation_id']),
    sourceMessageId: String(row['source_message_id']),
    // Total by construction rather than cast: an unknown value reads as prose,
    // which is what every row written before v4 is.
    kind: row['kind'] === 'code' ? 'code' : 'markdown',
    language: row['language'] === null ? null : String(row['language']),
    title: String(row['title']),
    content: String(row['content']),
    createdAt: Number(row['created_at']),
    updatedAt: Number(row['updated_at'])
  }
}
