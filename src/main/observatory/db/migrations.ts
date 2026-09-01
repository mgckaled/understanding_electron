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

// service/model own no foreign key — this table outlives the AiModel catalog
// entry it was measured against (a model can be uninstalled later).
const v2: Migration = (db) => {
  db.exec(`
    CREATE TABLE performance_events (
      id                      INTEGER PRIMARY KEY,
      service                 TEXT    NOT NULL,
      model                   TEXT    NOT NULL,
      eval_tokens             INTEGER NOT NULL,
      ttft_ms                 REAL    NOT NULL,
      decode_ms               REAL    NOT NULL,
      load_duration_ms        REAL,
      prompt_eval_duration_ms REAL,
      native_eval_duration_ms REAL,
      created_at              INTEGER NOT NULL
    );

    CREATE INDEX performance_events_by_created_at ON performance_events (created_at);
  `)
}

// New rung, not an edit to v2 (D14.2's own rule): a dev database that already
// ran v2 exists on this machine, with real rows in it — ALTER TABLE keeps
// them, editing v2 in place would not.
const v3: Migration = (db) => {
  db.exec(`ALTER TABLE performance_events ADD COLUMN prompt_tokens INTEGER;`)
}

export const migrations: readonly Migration[] = [v1, v2, v3]
