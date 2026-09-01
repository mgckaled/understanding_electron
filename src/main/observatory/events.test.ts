import { DatabaseSync } from 'node:sqlite'
import { migrate } from '../db/open'
import { migrations } from './db/migrations'
import { recordEvent, listEvents } from './events'

describe('recordEvent / listEvents', () => {
  it('records one row for a success and one for a failure', () => {
    const db = new DatabaseSync(':memory:')
    migrate(db, migrations)

    recordEvent(db, { channel: 'app:info', durationMs: 1.5, error: null, domainId: null })
    recordEvent(db, {
      channel: 'ai:chat',
      durationMs: 800,
      error: 'provider down',
      domainId: 'conv-1'
    })

    const rows = listEvents(db)
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.channel).sort()).toEqual(['ai:chat', 'app:info'])

    const failed = rows.find((row) => row.channel === 'ai:chat')
    expect(failed).toMatchObject({ error: 'provider down', domainId: 'conv-1' })
  })

  it('orders the newest event first', () => {
    const db = new DatabaseSync(':memory:')
    migrate(db, migrations)

    recordEvent(db, { channel: 'app:info', durationMs: 1, error: null, domainId: null })
    recordEvent(db, { channel: 'app:memory', durationMs: 1, error: null, domainId: null })

    expect(listEvents(db).map((row) => row.channel)).toEqual(['app:memory', 'app:info'])
  })
})
