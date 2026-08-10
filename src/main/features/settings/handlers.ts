import type { DatabaseSync } from 'node:sqlite'
import type { Args, AppSettings } from '@shared/ipc'
import { appSettingsSchema, DEFAULT_APP_SETTINGS } from '@shared/ipc'
import { inTransaction } from '../../db/transaction'

/*
 * One storage mechanism, one migration ladder (D14.7): machine settings share
 * the conversation database rather than bringing a second file and a second
 * versioning story.
 *
 * Values are stored as JSON so a future setting of any shape costs no schema
 * change — the table's own flexibility, deliberately not extended to the
 * contract, which stays typed.
 */

export function readSettings(_args: void, db: DatabaseSync): AppSettings {
  const stored: Record<string, unknown> = {}
  for (const row of db.prepare('SELECT key, value FROM app_settings').all()) {
    try {
      stored[String(row['key'])] = JSON.parse(String(row['value']))
    } catch {
      // A value this build cannot parse is skipped, and the default fills in.
    }
  }

  /*
   * This is the one read validated against a schema, and the exception proves
   * the rule rather than breaking it: "no zod on the way out" means main should
   * not distrust its own in-memory output. These bytes came off DISK — possibly
   * written by an older build, possibly edited by hand — and the ladder cannot
   * help, because a key-value table has no schema to migrate. Validating here
   * IS the migration path for settings.
   */
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
