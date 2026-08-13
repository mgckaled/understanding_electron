import type { DatabaseSync } from 'node:sqlite'
import type { Args, AppSettings } from '@shared/ipc'
import { appSettingsSchema, DEFAULT_APP_SETTINGS } from '@shared/ipc'
import { inTransaction } from '../../db/transaction'

// One storage mechanism, one migration ladder (D14.7): machine settings share
// the conversation database, not a second file with its own versioning. Values
// are JSON so a future setting of any shape costs no schema change — the table's
// flexibility, deliberately not extended to the contract, which stays typed.

export function readSettings(_args: void, db: DatabaseSync): AppSettings {
  const stored: Record<string, unknown> = {}
  for (const row of db.prepare('SELECT key, value FROM app_settings').all()) {
    try {
      stored[String(row['key'])] = JSON.parse(String(row['value']))
    } catch {
      // A value this build cannot parse is skipped, and the default fills in.
    }
  }

  // The one read validated against a schema, the exception that proves the rule:
  // "no zod on the way out" is about not distrusting main's own output, but
  // these bytes came off DISK (older build, hand-edited) and a key-value table
  // has no schema to migrate — validating here IS the migration path.
  const parsed = appSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, ...stored })
  return parsed.success ? parsed.data : DEFAULT_APP_SETTINGS
}

export function writeSettings(patch: Args<'settings:write'>, db: DatabaseSync): void {
  const upsert = db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  )

  inTransaction(db, () => {
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) upsert.run(key, JSON.stringify(value))
    }
  })
}
