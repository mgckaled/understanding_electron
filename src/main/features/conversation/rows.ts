import type { Conversation, Message, MessagePart, MessageRole } from '@shared/ipc'

/*
 * node:sqlite hands back `Record<string, null | number | bigint | string |
 * Uint8Array>` — there is no row generic like better-sqlite3's. So the typing
 * has to be rebuilt at this edge, and doing it in one place is what keeps the
 * casts from spreading across six handlers.
 *
 * These do NOT validate with zod, on purpose. The rule is zod on the arguments
 * crossing renderer → main, never on the way out (skill `architecture`): main
 * wrote these rows itself, and re-parsing its own writes is distrusting itself
 * at the cost of latency on every read. A corrupted `parts` payload makes
 * JSON.parse throw, which is the right answer for corrupted storage — a defect,
 * loud, not a Result the UI is asked to render.
 */

type Row = Record<string, unknown>

export function toConversation(row: Row): Conversation {
  return {
    id: String(row['id']),
    title: String(row['title']),
    // Number() and not a cast: the probe says milliseconds come back as
    // `number`, but a value above 2^53 would arrive as BigInt and silently
    // break every comparison downstream.
    createdAt: Number(row['created_at']),
    updatedAt: Number(row['updated_at'])
  }
}

export function toMessage(row: Row): Message {
  const model = row['model']
  return {
    id: String(row['id']),
    role: String(row['role']) as MessageRole,
    parts: JSON.parse(String(row['parts'])) as MessagePart[],
    createdAt: Number(row['created_at']),
    ...(model === null || model === undefined ? {} : { model: String(model) })
  }
}
