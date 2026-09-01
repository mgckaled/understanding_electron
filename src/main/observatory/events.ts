import type { DatabaseSync } from 'node:sqlite'
import type { EventRow } from '@shared/ipc'
import type { IpcCallEvent } from '@core/observatory/events'

export function recordEvent(db: DatabaseSync, event: IpcCallEvent): void {
  db.prepare(
    `INSERT INTO events (channel, duration_ms, error, domain_id, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(event.channel, event.durationMs, event.error, event.domainId, Date.now())
}

export function listEvents(db: DatabaseSync): EventRow[] {
  const rows = db
    .prepare(
      `SELECT channel, duration_ms, error, domain_id, created_at
       FROM events
       ORDER BY created_at DESC
       LIMIT 200`
    )
    .all() as Record<string, unknown>[]

  return rows.map((row) => ({
    channel: String(row['channel']),
    durationMs: Number(row['duration_ms']),
    error: row['error'] === null ? null : String(row['error']),
    domainId: row['domain_id'] === null ? null : String(row['domain_id']),
    createdAt: Number(row['created_at'])
  }))
}
