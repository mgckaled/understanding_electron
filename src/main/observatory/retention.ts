import type { DatabaseSync } from 'node:sqlite'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Deletes events older than `retentionDays` (O-6, DO6.5) — index-backed, no rewrite. */
export async function sweepExpiredEvents(
  db: DatabaseSync,
  retentionDays: number,
  now: () => number = Date.now
): Promise<void> {
  const cutoff = now() - retentionDays * MS_PER_DAY
  db.prepare('DELETE FROM events WHERE created_at < ?').run(cutoff)
}
