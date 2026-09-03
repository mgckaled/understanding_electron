import type { DatabaseSync } from 'node:sqlite'

// The migration ladder (D14.2): one function per version, indexed by the
// version it upgrades FROM (`migrations[0]` takes a fresh file to 1). Append a
// rung, never edit a shipped one — a database out there has already run it. The
// ladder is exercised by a test with a fixture rung, since a single real rung
// never climbs anything and the second is written under pressure later.
export type Migration = (db: DatabaseSync) => void

// Column vs JSON, decided by D13.4/D14.1: what the sidebar lists is a column,
// what only the model call reads is `settings` JSON (num_ctx, temperature, the
// system prompt), which keeps each new button from costing a migration. `parts`
// is JSON so the plano-16/17 MessagePart variants cost none; `stopped` is a
// column, not content, so the interface need not open the JSON to draw a label.
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

// One row per cloud provider (DN1A.2, plano N-1-A) — never the app_settings
// table: readSettings() does SELECT * with no filter, which would hand the
// renderer the ciphertext on every settings:read. ciphertext is a BLOB:
// safeStorage.encryptString() returns a Buffer, a Uint8Array subclass that
// node:sqlite accepts directly, no base64 detour.
const v2: Migration = (db) => {
  db.exec(`
    CREATE TABLE secrets (
      provider   TEXT PRIMARY KEY,
      ciphertext BLOB NOT NULL
    );
  `)
}

// A draft is NOT a message part, though `parts` being JSON would have made it
// free (DE1A.1): a table cannot reach toChatMessages, which reads `messages`.
// `source_message_id` carries no foreign key on purpose — it is provenance, not
// ownership, and node:sqlite enables foreign_keys by default, so a cascade
// there would delete text the user edited (DE1A.2).
const v3: Migration = (db) => {
  db.exec(`
    CREATE TABLE drafts (
      id                TEXT PRIMARY KEY,
      conversation_id   TEXT    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      source_message_id TEXT    NOT NULL,
      title             TEXT    NOT NULL,
      content           TEXT    NOT NULL,
      created_at        INTEGER NOT NULL,
      updated_at        INTEGER NOT NULL
    );

    CREATE INDEX drafts_by_conversation ON drafts (conversation_id, created_at);
  `)
}

// Code arrives as a draft of another dialect (DE2A.1), so the two columns land
// here rather than in a table of their own. `language` is separate from `kind`
// because a fence can omit the language and still be code (DE2A.2).
const v4: Migration = (db) => {
  db.exec(`
    ALTER TABLE drafts ADD COLUMN kind TEXT NOT NULL DEFAULT 'markdown';
    ALTER TABLE drafts ADD COLUMN language TEXT;
  `)
}

// The real per-turn counts Ollama/GLM/Gemini report (21-C, live-tested finding):
// computed to calibrate the meter's ratio and then discarded, never shown. Two
// plain columns, same precedent as `stopped` — small numbers, no reason to open
// `parts` JSON to read them. `eval_tokens` is generation as the provider counts
// it: thinking and the final answer share one budget (no separate counter), so
// a reasoning-heavy turn's real cost is only visible here, not in the meter,
// which never resends reasoning (D21A.3) and has no reason to estimate it.
const v5: Migration = (db) => {
  db.exec(`
    ALTER TABLE messages ADD COLUMN prompt_tokens INTEGER;
    ALTER TABLE messages ADD COLUMN eval_tokens INTEGER;
  `)
}

export const migrations: readonly Migration[] = [v1, v2, v3, v4, v5]
