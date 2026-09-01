import { DatabaseSync } from 'node:sqlite'
import { migrate } from '../db/open'
import { migrations } from './db/migrations'
import { recordEvent, listEvents } from './events'
import { sweepExpiredEvents } from './retention'

const DAY = 24 * 60 * 60 * 1000

function seededDb(fixedNow: number): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  migrate(db, migrations)

  recordEvent(db, { channel: 'old', durationMs: 1, error: null, domainId: null })
  // Backdate directly — recordEvent always stamps Date.now().
  db.prepare('UPDATE events SET created_at = ? WHERE channel = ?').run(1, 'old')
  recordEvent(db, { channel: 'recent', durationMs: 1, error: null, domainId: null })
  db.prepare('UPDATE events SET created_at = ? WHERE channel = ?').run(fixedNow - DAY, 'recent')

  return db
}

describe('sweepExpiredEvents', () => {
  it('deletes rows older than retentionDays and keeps the rest', async () => {
    const fixedNow = 100 * DAY
    const db = seededDb(fixedNow)

    await sweepExpiredEvents(db, 30, () => fixedNow)

    // A wide window on the read side, so this checks the physical DELETE, not
    // listEvents' own retentionDays filter (added after DO6.7(b)'s review).
    expect(listEvents(db, 100_000, () => fixedNow).map((row) => row.channel)).toEqual(['recent'])
  })

  it('a shorter retentionDays deletes more, a longer one deletes less', async () => {
    const fixedNow = 100 * DAY

    const strict = seededDb(fixedNow)
    await sweepExpiredEvents(strict, 0, () => fixedNow)
    expect(listEvents(strict, 100_000, () => fixedNow)).toHaveLength(0)

    const lenient = seededDb(fixedNow)
    await sweepExpiredEvents(lenient, 90, () => fixedNow)
    expect(listEvents(lenient, 100_000, () => fixedNow).map((row) => row.channel)).toEqual([
      'recent'
    ])
  })
})
