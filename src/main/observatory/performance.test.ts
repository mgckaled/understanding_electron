import { DatabaseSync } from 'node:sqlite'
import { migrate } from '../db/open'
import { migrations } from './db/migrations'
import { recordPerformanceEvent, listPerformanceEvents } from './performance'

describe('recordPerformanceEvent / listPerformanceEvents', () => {
  it('records a row with the native fields present, and one without them', () => {
    const db = new DatabaseSync(':memory:')
    migrate(db, migrations)

    recordPerformanceEvent(db, {
      service: 'ollama',
      model: 'gemma3:4b',
      promptTokens: 512,
      evalTokens: 42,
      ttftMs: 120,
      decodeMs: 900,
      loadDurationMs: 48_000,
      promptEvalDurationMs: 80,
      nativeEvalDurationMs: 850
    })
    recordPerformanceEvent(db, {
      service: 'glm',
      model: 'glm-4.5',
      evalTokens: 30,
      ttftMs: 400,
      decodeMs: 600
    })

    const rows = listPerformanceEvents(db, 30)
    expect(rows).toHaveLength(2)

    const ollamaRow = rows.find((row) => row.service === 'ollama')
    expect(ollamaRow).toMatchObject({
      promptTokens: 512,
      loadDurationMs: 48_000,
      promptEvalDurationMs: 80
    })

    const cloudRow = rows.find((row) => row.service === 'glm')
    expect(cloudRow?.promptTokens).toBeUndefined()
    expect(cloudRow?.loadDurationMs).toBeUndefined()
  })

  it('filters by retentionDays at read time (DO6.7(b)-equivalent)', () => {
    const db = new DatabaseSync(':memory:')
    migrate(db, migrations)

    recordPerformanceEvent(db, {
      service: 'ollama',
      model: 'gemma3:4b',
      evalTokens: 10,
      ttftMs: 100,
      decodeMs: 500
    })
    const DAY = 24 * 60 * 60 * 1000
    db.prepare('UPDATE performance_events SET created_at = ?').run(Date.now() - 40 * DAY)

    expect(listPerformanceEvents(db, 30)).toHaveLength(0)
    expect(listPerformanceEvents(db, 90)).toHaveLength(1)
  })

  it('v3 climbs over a database that already ran v1+v2 with a real row in it (ALTER TABLE, not a rewrite)', () => {
    const db = new DatabaseSync(':memory:')
    migrate(db, migrations.slice(0, 2)) // v1 + v2 only — the shape the user's machine already had

    // Raw INSERT against the pre-v3 shape: recordPerformanceEvent already
    // assumes prompt_tokens exists, which is exactly what this row predates.
    db.prepare(
      `INSERT INTO performance_events (service, model, eval_tokens, ttft_ms, decode_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('ollama', 'qwen2.5-coder:3b', 100, 400, 1500, Date.now())

    migrate(db, migrations) // climbs to v3 on the SAME connection, row already present

    const rows = listPerformanceEvents(db, 30)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ model: 'qwen2.5-coder:3b', evalTokens: 100 })
    // Backfilled NULL, not an error and not a fabricated 0 — the row predates
    // promptTokens existing at all.
    expect(rows[0].promptTokens).toBeUndefined()
  })
})
