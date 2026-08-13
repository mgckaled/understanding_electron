import { DatabaseSync } from 'node:sqlite'
import { migrations, type Migration } from './migrations'
import { inTransaction } from './transaction'

/** File name under app.getPath('userData') — the caller supplies the folder. */
export const DATABASE_FILE = 'crivo.db'

// Storage is synchronous in the main process, against D9.1's letter: accepted
// because listing and inserting are indexed microsecond operations and nothing
// writes per token (D14.8); the trigger to revisit is full-text search over the
// whole history. `open()` takes the path (DIP), so every test runs against
// ':memory:' without Electron — only the composition root knows the real path.

export function currentVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get()
  return Number(row?.['user_version'] ?? 0)
}

/**
 * Climbs the ladder from whatever version the file is at, and returns where it
 * stopped. Running it on an up-to-date database is a no-op.
 */
export function migrate(db: DatabaseSync, ladder: readonly Migration[] = migrations): number {
  for (let version = currentVersion(db); version < ladder.length; version++) {
    // One transaction per rung. A rung that throws halfway must not leave the
    // schema half-applied with user_version already bumped — the next open
    // would then skip it and fail somewhere far from the cause.
    inTransaction(db, () => {
      ladder[version](db)
      // Pragmas cannot be parameterised — SQLite compiles them, so `?` is not
      // bound here. Safe only because the value is the loop index, never input.
      db.exec(`PRAGMA user_version = ${version + 1}`)
    })
  }
  return currentVersion(db)
}

/**
 * Opens (creating if needed) the database at `path` and brings it up to date.
 * `foreign_keys` is deliberately not set: node:sqlite turns it on by default
 * (unlike raw SQLite), so a test counting on inserting an orphan message would
 * not work here.
 */
export function openDatabase(
  path: string,
  ladder: readonly Migration[] = migrations
): DatabaseSync {
  const db = new DatabaseSync(path)
  // WAL lets a reader run while a writer commits, and survives a crash without
  // the rollback journal's fsync cost. Silently ignored by ':memory:', which
  // answers `memory` — that is why the file-backed test below exists.
  db.exec('PRAGMA journal_mode = wal')
  migrate(db, ladder)
  return db
}
