import type { Migration } from '../../db/migrations'

/** File name under app.getPath('userData') — separate from crivo.db (O-6, DO6 § 3.3). */
export const OBSERVATORY_DATABASE_FILE = 'observatory.db'

// No AUTOINCREMENT/STRICT — matches crivo.db's migrations.ts convention, and
// AUTOINCREMENT would forbid rowid reuse, wrong for a table that only ever
// grows by INSERT and shrinks by DELETE-by-age.
const v1: Migration = (db) => {
  db.exec(`
    CREATE TABLE events (
      id          INTEGER PRIMARY KEY,
      channel     TEXT    NOT NULL,
      duration_ms REAL    NOT NULL,
      error       TEXT,
      domain_id   TEXT,
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX events_by_created_at ON events (created_at);
  `)
}

export const migrations: readonly Migration[] = [v1]
