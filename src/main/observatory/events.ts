import type { DatabaseSync } from 'node:sqlite'
import type { EventRow } from '@shared/ipc'
import type { IpcCallEvent } from '@core/observatory/events'

export function recordEvent(db: DatabaseSync, event: IpcCallEvent): void {
  db.prepare(
    `INSERT INTO events (channel, duration_ms, error, domain_id, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(event.channel, event.durationMs, event.error, event.domainId, Date.now())
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Filters by `retentionDays` even though the boot sweep already deletes past
 * that window — the two run on different clocks, and a `retentionDays` just
 * lowered in Configurações must not wait for a restart to stop showing rows
 * the panel's own header says are gone (O-6, DO6.7(b)).
 */
export function listEvents(
  db: DatabaseSync,
  retentionDays: number,
  now: () => number = Date.now
): EventRow[] {
  const cutoff = now() - retentionDays * MS_PER_DAY
  const rows = db
    .prepare(
      `SELECT id, channel, duration_ms, error, domain_id, created_at
       FROM events
       WHERE created_at >= ?
       ORDER BY created_at DESC
       LIMIT 200`
    )
    .all(cutoff) as Record<string, unknown>[]

  return rows.map((row) => ({
    id: Number(row['id']),
    channel: String(row['channel']),
    durationMs: Number(row['duration_ms']),
    error: row['error'] === null ? null : String(row['error']),
    domainId: row['domain_id'] === null ? null : String(row['domain_id']),
    createdAt: Number(row['created_at'])
  }))
}
