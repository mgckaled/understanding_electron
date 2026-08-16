import type { DatabaseSync } from 'node:sqlite'
import { sweepUnreferenced } from './storage'

/**
 * Every attachment hash any message currently references — the GLOBAL set
 * (D16.2), not scoped to one conversation, so a blob shared by two survives
 * either one's removal. Verified directly against `node:sqlite`: `json_each`
 * is available (JSON1 built in since SQLite 3.38), no table needed.
 */
export function referencedHashes(db: DatabaseSync): Set<string> {
  const rows = db
    .prepare(
      `SELECT DISTINCT json_extract(p.value, '$.hash') AS hash
       FROM messages, json_each(messages.parts) AS p
       WHERE json_extract(p.value, '$.hash') IS NOT NULL`
    )
    .all() as Record<string, unknown>[]
  return new Set(rows.map((row) => String(row['hash'])))
}

/**
 * Deletes every attachment blob nothing currently references (D16.2). Called
 * after a conversation is removed — a shared blob survives because its hash
 * is still in the recomputed global set — and once at startup, closing the
 * gap D16.2 anticipated: an attach that succeeded and was then discarded
 * before ever being sent leaves a blob no removal event will trigger.
 */
export async function collectOrphanedAttachments(db: DatabaseSync, dir: string): Promise<void> {
  await sweepUnreferenced(dir, referencedHashes(db))
}
