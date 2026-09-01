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
    expect(ollamaRow).toMatchObject({ loadDurationMs: 48_000, promptEvalDurationMs: 80 })

    const cloudRow = rows.find((row) => row.service === 'glm')
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
})
