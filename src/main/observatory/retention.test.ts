import { DatabaseSync } from 'node:sqlite'
import { migrate } from '../db/open'
import { migrations } from './db/migrations'
import { recordEvent, listEvents } from './events'
import { sweepExpiredEvents } from './retention'

const DAY = 24 * 60 * 60 * 1000

describe('sweepExpiredEvents', () => {
  it('removes rows older than retentionDays and keeps the rest', async () => {
    const db = new DatabaseSync(':memory:')
    migrate(db, migrations)
    const fixedNow = 100 * DAY

    recordEvent(db, { channel: 'old', durationMs: 1, error: null, domainId: null })
    // Backdate the "old" row directly — recordEvent always stamps Date.now().
    db.prepare('UPDATE events SET created_at = ? WHERE channel = ?').run(1, 'old')
    recordEvent(db, { channel: 'recent', durationMs: 1, error: null, domainId: null })
    db.prepare('UPDATE events SET created_at = ? WHERE channel = ?').run(fixedNow - DAY, 'recent')

    await sweepExpiredEvents(db, 30, () => fixedNow)

    expect(listEvents(db).map((row) => row.channel)).toEqual(['recent'])
  })
})
