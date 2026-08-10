import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Migration } from './migrations'
import { migrations } from './migrations'
import { currentVersion, migrate, openDatabase } from './open'

function tableNames(db: DatabaseSync): string[] {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => String(row['name']))
    .filter((name) => !name.startsWith('sqlite_'))
}

describe('openDatabase', () => {
  it('takes a fresh database from v0 to v1, creating the three tables', () => {
    const db = new DatabaseSync(':memory:')
    expect(currentVersion(db)).toBe(0)
    db.close()

    const opened = openDatabase(':memory:')

    expect(currentVersion(opened)).toBe(1)
    expect(tableNames(opened)).toEqual(['app_settings', 'conversations', 'messages'])
    opened.close()
  })

  it('is a no-op on a database already at the top of the ladder', () => {
    const db = openDatabase(':memory:')

    // Re-running must not re-execute v1 — a second CREATE TABLE would throw.
    expect(migrate(db)).toBe(1)
    expect(currentVersion(db)).toBe(1)
    db.close()
  })

  it('turns WAL on for a file-backed database', () => {
    // ':memory:' answers `memory` to this pragma, so the WAL decision is only
    // provable against a real file — the same reason the plan's probe needed one.
    const folder = mkdtempSync(join(tmpdir(), 'crivo-db-'))
    const db = openDatabase(join(folder, 'probe.db'))

    expect(db.prepare('PRAGMA journal_mode').get()?.['journal_mode']).toBe('wal')

    db.close()
    rmSync(folder, { recursive: true, force: true })
  })
})

/*
 * The rung that proves the ladder (D14.2). The fixture rung lives here and
 * never in production code: what is under test is that a SECOND rung runs at
 * all, on a database that already has rows in it — the situation the real v2
 * will meet, and the one a single-rung ladder never exercises.
 */
describe('migrate — the second rung', () => {
  const v2: Migration = (db) => {
    db.exec('ALTER TABLE conversations ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0')
  }

  function seeded(): DatabaseSync {
    const db = openDatabase(':memory:')
    db.prepare(
      'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run('c1', 'Vendas', 1000, 1000)
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, parts, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run('m1', 'c1', 'user', '[{"kind":"text","text":"oi"}]', 1000)
    return db
  }

  it('climbs from v1 to v2 leaving the existing rows intact', () => {
    const db = seeded()

    expect(migrate(db, [...migrations, v2])).toBe(2)

    expect(currentVersion(db)).toBe(2)
    const conversation = db.prepare('SELECT title, pinned FROM conversations').get()
    expect(conversation?.['title']).toBe('Vendas')
    expect(conversation?.['pinned']).toBe(0)
    expect(db.prepare('SELECT COUNT(*) AS n FROM messages').get()?.['n']).toBe(1)
    db.close()
  })

  it('rolls back a rung that throws, leaving the version where it was', () => {
    const db = seeded()
    const broken: Migration = (database) => {
      database.exec('CREATE TABLE half (id TEXT PRIMARY KEY)')
      throw new Error('rung failed halfway')
    }

    expect(() => migrate(db, [...migrations, broken])).toThrow('rung failed halfway')

    // Both halves matter: a bumped version would make the next open skip the
    // rung, and a surviving table would make its retry fail on CREATE TABLE.
    expect(currentVersion(db)).toBe(1)
    expect(tableNames(db)).not.toContain('half')
    db.close()
  })
})
