import type { DatabaseSync } from 'node:sqlite'

/*
 * The migration ladder (D14.2).
 *
 * One function per version, indexed by the version it upgrades FROM:
 * `migrations[0]` takes a fresh file (user_version 0) to 1. Adding a rung is
 * appending to this array — never editing a rung that has already shipped,
 * because a database out there has already run it.
 *
 * A ladder with a single rung has never climbed anything: it runs v0 → v1 on
 * first open and is never executed again on any machine. The second rung will
 * be written under pressure from something else, and its defect would show up
 * on a database that already has conversations inside. That is why the ladder
 * itself is exercised by a test with a fixture rung, not just written.
 */
export type Migration = (db: DatabaseSync) => void

/*
 * What is a column and what is JSON is decided by D13.4/D14.1: what the sidebar
 * lists becomes a column; what only the model call reads becomes `settings`
 * JSON. `num_ctx`, temperature and the system prompt (plano 15) go in there,
 * which is what keeps each new button from costing a migration.
 *
 * `parts` is JSON for the same reason: the 'dataset' (plano 16) and
 * 'document'/'image' (plano 17) variants of MessagePart cost no migration.
 *
 * `stopped` is a column and not part of `parts`: it is metadata about the turn,
 * not content — putting it inside the JSON would force the interface to open
 * the payload just to know whether to draw a label (D14.3).
 */
const v1: Migration = (db) => {
  db.exec(`
    CREATE TABLE conversations (
      id         TEXT PRIMARY KEY,
      title      TEXT    NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      settings   TEXT    NOT NULL DEFAULT '{}'
    );

    CREATE TABLE messages (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role            TEXT    NOT NULL,
      parts           TEXT    NOT NULL,
      created_at      INTEGER NOT NULL,
      model           TEXT,
      stopped         TEXT
    );

    CREATE TABLE app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX messages_by_conversation ON messages (conversation_id, created_at);
    CREATE INDEX conversations_by_updated ON conversations (updated_at DESC);
  `)
}

export const migrations: readonly Migration[] = [v1]
