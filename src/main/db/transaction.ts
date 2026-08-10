import type { DatabaseSync } from 'node:sqlite'

/**
 * Runs `fn` inside a single SQLite transaction, rolling back if it throws.
 *
 * node:sqlite has no `db.transaction()` wrapper like better-sqlite3 does, so
 * this is written once here rather than repeated at every call site — the shape
 * that is easy to get subtly wrong is the ROLLBACK on the failure path, and a
 * half-applied write is exactly what a transaction exists to prevent.
 *
 * Not reentrant: SQLite rejects a nested BEGIN. Every caller in this project is
 * a leaf operation, which is what makes that acceptable.
 */
export function inTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN')
  try {
    const value = fn()
    db.exec('COMMIT')
    return value
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
