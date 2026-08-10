import { DatabaseSync } from 'node:sqlite'
import { migrations, type Migration } from './migrations'
import { inTransaction } from './transaction'

/** File name under app.getPath('userData') — the caller supplies the folder. */
export const DATABASE_FILE = 'crivo.db'

/*
 * Storage lives in the main process and the API is synchronous, which
 * contradicts D9.1 on the letter. It is accepted because listing conversations
 * and inserting a message are indexed microsecond operations, and because
 * nothing here writes per token — only a finished turn reaches disk (D14.8).
 * The trigger that reopens it is full-text search over the whole history.
 *
 * `open()` takes the path as a parameter (DIP) — that is what makes every test
 * below run against ':memory:' without booting Electron. Nothing in this folder
 * imports `electron`; `app.getPath('userData')` is resolved by the composition
 * root, which is the only place allowed to know about it.
 */

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
 *
 * `foreign_keys` is deliberately not set: node:sqlite turns it on by default,
 * unlike raw SQLite where it is 0. Writing the PRAGMA would be harmless; what
 * is not harmless is assuming the opposite and counting on inserting an orphan
 * message in a test. That does not work here.
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
