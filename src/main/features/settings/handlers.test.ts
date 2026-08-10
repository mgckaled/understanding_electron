import type { DatabaseSync } from 'node:sqlite'
import { DEFAULT_APP_SETTINGS } from '@shared/ipc'
import { openDatabase } from '../../db/open'
import { readSettings, writeSettings } from './handlers'

let db: DatabaseSync

beforeEach(() => {
  db = openDatabase(':memory:')
})

afterEach(() => {
  db.close()
})

function put(key: string, rawValue: string): void {
  db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run(key, rawValue)
}

describe('readSettings', () => {
  it('returns the defaults on a database that has never been written to', () => {
    expect(readSettings(undefined, db)).toEqual(DEFAULT_APP_SETTINGS)
  })

  it('ignores a key this build does not know about', () => {
    // The table is key-value precisely so plano 17 can add one without a
    // migration. The reverse — an older build meeting a newer key — must not
    // break, and the schema's default stripping is what makes that true.
    put('futureSetting', '"whatever"')

    expect(readSettings(undefined, db)).toEqual(DEFAULT_APP_SETTINGS)
  })

  it('falls back to the defaults when a stored value is not valid', () => {
    // A key-value table has no schema for the migration ladder to climb, so
    // validating on READ is the migration path for settings (D14.7).
    put('numThread', '0')

    expect(readSettings(undefined, db)).toEqual(DEFAULT_APP_SETTINGS)
  })

  it('survives a value that is not JSON at all', () => {
    put('numThread', 'not json')

    expect(readSettings(undefined, db)).toEqual(DEFAULT_APP_SETTINGS)
  })
})

describe('writeSettings', () => {
  it('persists a value and reads it back', () => {
    writeSettings({ numThread: 2 }, db)

    expect(readSettings(undefined, db)).toEqual({ numThread: 2 })
  })

  it('overwrites rather than accumulating rows for the same key', () => {
    writeSettings({ numThread: 2 }, db)
    writeSettings({ numThread: 6 }, db)

    expect(readSettings(undefined, db)).toEqual({ numThread: 6 })
    expect(db.prepare('SELECT COUNT(*) AS n FROM app_settings').get()?.['n']).toBe(1)
  })

  it('leaves untouched keys alone when given a partial patch', () => {
    put('futureSetting', '"kept"')

    writeSettings({ numThread: 3 }, db)

    expect(db.prepare("SELECT value FROM app_settings WHERE key = 'futureSetting'").get()).toEqual({
      value: '"kept"'
    })
  })
})
