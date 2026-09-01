import type { DatabaseSync } from 'node:sqlite'
import type { AiService, PrivacyLedger, PrivacyRow } from '@shared/ipc'
import type { PrivacyEvent } from '@core/observatory/privacy'

export function recordPrivacyEvent(db: DatabaseSync, event: PrivacyEvent): void {
  db.prepare(
    `INSERT INTO privacy_events
       (service, model, dataset_count, document_count, image_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    event.service,
    event.model,
    event.datasetCount,
    event.documentCount,
    event.imageCount,
    Date.now()
  )
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * `rows` is `LIMIT 200`, newest first — same window as `listEvents` (O-6).
 * `totalCalls`/`callsWithAttachment` sum over the FULL retention window, not
 * over `rows`: cloud calls are mostly text-only (DO8.5), so the 200 most
 * recent rows would otherwise be dominated by zero-count calls and push the
 * attachment exposures — the reason this panel exists — out of view (DO8.8).
 */
export function readPrivacyLedger(
  db: DatabaseSync,
  retentionDays: number,
  now: () => number = Date.now
): PrivacyLedger {
  const cutoff = now() - retentionDays * MS_PER_DAY

  const rawRows = db
    .prepare(
      `SELECT id, service, model, dataset_count, document_count, image_count, created_at
       FROM privacy_events
       WHERE created_at >= ?
       ORDER BY created_at DESC
       LIMIT 200`
    )
    .all(cutoff) as Record<string, unknown>[]

  const rows: PrivacyRow[] = rawRows.map((row) => ({
    id: Number(row['id']),
    // Cast, not parsed: this row is data this file wrote itself (recordPrivacyEvent
    // only ever receives an AiService), not user input crossing a trust boundary.
    service: row['service'] as AiService,
    model: String(row['model']),
    datasetCount: Number(row['dataset_count']),
    documentCount: Number(row['document_count']),
    imageCount: Number(row['image_count']),
    createdAt: Number(row['created_at'])
  }))

  const overview = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN dataset_count + document_count + image_count > 0 THEN 1 ELSE 0 END) AS with_attachment
       FROM privacy_events
       WHERE created_at >= ?`
    )
    .get(cutoff) as Record<string, unknown> | undefined

  return {
    rows,
    totalCalls: Number(overview?.['total'] ?? 0),
    callsWithAttachment: Number(overview?.['with_attachment'] ?? 0)
  }
}
