import { DatabaseSync } from 'node:sqlite'
import { migrate } from '../db/open'
import { migrations } from './db/migrations'
import { recordPrivacyEvent, readPrivacyLedger } from './privacy'

const DAY = 24 * 60 * 60 * 1000

describe('recordPrivacyEvent / readPrivacyLedger', () => {
  it('records a row with zero counts (text-only cloud call) and one with attachments', () => {
    const db = new DatabaseSync(':memory:')
    migrate(db, migrations)

    recordPrivacyEvent(db, {
      service: 'glm',
      model: 'glm-4.6',
      datasetCount: 0,
      documentCount: 0,
      imageCount: 0
    })
    recordPrivacyEvent(db, {
      service: 'gemini',
      model: 'gemini-2.0-flash',
      datasetCount: 1,
      documentCount: 0,
      imageCount: 2
    })

    const ledger = readPrivacyLedger(db, 30)
    expect(ledger.rows).toHaveLength(2)
    expect(ledger.totalCalls).toBe(2)
    expect(ledger.callsWithAttachment).toBe(1)

    const textOnlyRow = ledger.rows.find((row) => row.service === 'glm')
    expect(textOnlyRow).toMatchObject({ datasetCount: 0, documentCount: 0, imageCount: 0 })

    const withAttachmentRow = ledger.rows.find((row) => row.service === 'gemini')
    expect(withAttachmentRow).toMatchObject({ datasetCount: 1, documentCount: 0, imageCount: 2 })
  })

  it('filters by retentionDays at read time, same discipline as listPerformanceEvents', () => {
    const db = new DatabaseSync(':memory:')
    migrate(db, migrations)

    recordPrivacyEvent(db, {
      service: 'glm',
      model: 'glm-4.6',
      datasetCount: 1,
      documentCount: 0,
      imageCount: 0
    })
    db.prepare('UPDATE privacy_events SET created_at = ?').run(Date.now() - 40 * DAY)

    expect(readPrivacyLedger(db, 30).rows).toHaveLength(0)
    expect(readPrivacyLedger(db, 30).totalCalls).toBe(0)
    expect(readPrivacyLedger(db, 90).rows).toHaveLength(1)
    expect(readPrivacyLedger(db, 90).totalCalls).toBe(1)
  })

  it('totalCalls/callsWithAttachment sum over the full window even when rows is capped (DO8.8)', () => {
    const db = new DatabaseSync(':memory:')
    migrate(db, migrations)

    // More than the 200-row LIMIT would need to matter — a small number here
    // proves the overview query is independent of the row cap, not that the
    // cap itself is reachable in a fast unit test.
    for (let i = 0; i < 5; i++) {
      recordPrivacyEvent(db, {
        service: 'glm',
        model: 'glm-4.6',
        datasetCount: 0,
        documentCount: 0,
        imageCount: 0
      })
    }
    recordPrivacyEvent(db, {
      service: 'glm',
      model: 'glm-4.6',
      datasetCount: 1,
      documentCount: 0,
      imageCount: 0
    })

    const ledger = readPrivacyLedger(db, 30)
    expect(ledger.rows).toHaveLength(6)
    expect(ledger.totalCalls).toBe(6)
    expect(ledger.callsWithAttachment).toBe(1)
  })

  it('overview counters are zero, not NaN/undefined, against an empty table', () => {
    const db = new DatabaseSync(':memory:')
    migrate(db, migrations)

    const ledger = readPrivacyLedger(db, 30)
    expect(ledger).toEqual({ rows: [], totalCalls: 0, callsWithAttachment: 0 })
  })
})
