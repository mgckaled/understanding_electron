import { join } from 'node:path'
import { sqlPath } from './config'

// Mirrors main/attachments/protocol.ts's HASH_PATTERN (D17.6) — two call
// sites, not extracted (régua dos três, D18B.5).
const HASH_PATTERN = /^[a-f0-9]{64}$/

export function isValidHash(hash: string): boolean {
  return HASH_PATTERN.test(hash)
}

/**
 * Rejects anything that is not a single read-only statement (D18B.2) — best
 * effort, sitting in front of the real boundary, which is the restricted
 * engine (D18A.3). A trailing `;` is allowed once; a second one means a
 * hidden statement (`SELECT 1; DROP VIEW dataset;`).
 */
export function isReadOnlyQuery(sql: string): boolean {
  const trimmed = sql.trim()
  if (!/^(select|with)\b/i.test(trimmed)) return false
  const body = trimmed.endsWith(';') ? trimmed.slice(0, -1) : trimmed
  return !body.includes(';')
}

/**
 * The `dataset` view — interpolated, not bound: live-confirmed in passo 3
 * that DuckDB rejects a bound parameter as `read_csv_auto`'s argument
 * ("Binder Error: Unexpected prepared parameter. This type of statement
 * can't be prepared!"). Safe despite the interpolation: `hash` already
 * passed the 64-char hex format check, so nothing user-controlled enters
 * the string verbatim.
 *
 * @throws When `hash` is not a 64-char lowercase hex string.
 */
export function buildViewSqlInterpolated(hash: string, attachmentsDir: string): string {
  if (!isValidHash(hash)) throw new Error(`invalid attachment hash: ${hash}`)
  return `CREATE OR REPLACE VIEW dataset AS SELECT * FROM read_csv_auto('${sqlPath(join(attachmentsDir, hash))}')`
}

/**
 * Wraps `sql` in the row cap (D18B.4) — mechanical, no opinion on `limit`:
 * this channel calls it with 201 (the N+1 truncation trick), 18-C calls it
 * with 50 and no trick. A trailing `;` on `sql` is stripped first, or it
 * would land inside the wrapping parentheses as invalid SQL.
 */
export function buildFinalSql(sql: string, limit: number): string {
  const body = sql.trim().replace(/;\s*$/, '')
  return `SELECT * FROM (${body}) LIMIT ${limit}`
}
