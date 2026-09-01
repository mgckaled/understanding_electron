import { openDatabase } from '../../db/open'
import { migrations } from '../../db/migrations'
import { readDatabaseInfo } from './handlers'

describe('readDatabaseInfo', () => {
  it('reports the current migration version', () => {
    const db = openDatabase(':memory:')
    expect(readDatabaseInfo(db).migrationVersion).toBe(migrations.length)
  })

  it('lists every table from the ladder with zero rows on a fresh database', () => {
    const db = openDatabase(':memory:')
    const names = readDatabaseInfo(db).tables.map((table) => table.name)
    expect(names).toEqual(
      expect.arrayContaining(['conversations', 'messages', 'app_settings', 'secrets', 'drafts'])
    )
    expect(readDatabaseInfo(db).tables.every((table) => table.rowCount === 0)).toBe(true)
  })

  it('counts real rows inserted into a table', () => {
    const db = openDatabase(':memory:')
    db.prepare(
      'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run('c1', 'Title', 0, 0)

    const conversations = readDatabaseInfo(db).tables.find(
      (table) => table.name === 'conversations'
    )
    expect(conversations?.rowCount).toBe(1)
  })

  it('sizeBytes is page_count times page_size', () => {
    const db = openDatabase(':memory:')
    const pageCount = Number(
      (db.prepare('PRAGMA page_count').get() as { page_count: number }).page_count
    )
    const pageSize = Number(
      (db.prepare('PRAGMA page_size').get() as { page_size: number }).page_size
    )

    expect(readDatabaseInfo(db).sizeBytes).toBe(pageCount * pageSize)
  })

  // Proves DO3.4: the table list has to come from sqlite_master, not a
  // literal ['conversations', 'messages', ...] copied from migrations.ts —
  // a hardcoded list would never see this table.
  it('picks up a table the code never named, derived from sqlite_master', () => {
    const db = openDatabase(':memory:')
    db.exec('CREATE TABLE probe_o3 (x INTEGER)')

    const probe = readDatabaseInfo(db).tables.find((table) => table.name === 'probe_o3')
    expect(probe).toEqual({ name: 'probe_o3', rowCount: 0 })
  })
})
