import type { DatabaseSync } from 'node:sqlite'
import type { AiService } from '@shared/ipc'
import type { PerformanceEvent, PerformanceRow } from '@core/observatory/performance'

export function recordPerformanceEvent(db: DatabaseSync, event: PerformanceEvent): void {
  db.prepare(
    `INSERT INTO performance_events
       (service, model, prompt_tokens, eval_tokens, ttft_ms, decode_ms,
        load_duration_ms, prompt_eval_duration_ms, native_eval_duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    event.service,
    event.model,
    event.promptTokens ?? null,
    event.evalTokens,
    event.ttftMs,
    event.decodeMs,
    event.loadDurationMs ?? null,
    event.promptEvalDurationMs ?? null,
    event.nativeEvalDurationMs ?? null,
    Date.now()
  )
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Mirrors `listEvents` (O-6): filtered by `retentionDays` at read time, not just at the boot sweep (DO6.7(b)). */
export function listPerformanceEvents(
  db: DatabaseSync,
  retentionDays: number,
  now: () => number = Date.now
): PerformanceRow[] {
  const cutoff = now() - retentionDays * MS_PER_DAY
  const rows = db
    .prepare(
      `SELECT id, service, model, prompt_tokens, eval_tokens, ttft_ms, decode_ms,
              load_duration_ms, prompt_eval_duration_ms, native_eval_duration_ms, created_at
       FROM performance_events
       WHERE created_at >= ?
       ORDER BY created_at DESC`
    )
    .all(cutoff) as Record<string, unknown>[]

  return rows.map((row) => ({
    id: Number(row['id']),
    // Cast, not parsed: this row is data this file wrote itself (recordPerformanceEvent
    // only ever receives an AiService), not user input crossing a trust boundary.
    service: row['service'] as AiService,
    model: String(row['model']),
    promptTokens: row['prompt_tokens'] === null ? undefined : Number(row['prompt_tokens']),
    evalTokens: Number(row['eval_tokens']),
    ttftMs: Number(row['ttft_ms']),
    decodeMs: Number(row['decode_ms']),
    loadDurationMs: row['load_duration_ms'] === null ? undefined : Number(row['load_duration_ms']),
    promptEvalDurationMs:
      row['prompt_eval_duration_ms'] === null ? undefined : Number(row['prompt_eval_duration_ms']),
    nativeEvalDurationMs:
      row['native_eval_duration_ms'] === null ? undefined : Number(row['native_eval_duration_ms']),
    createdAt: Number(row['created_at'])
  }))
}
