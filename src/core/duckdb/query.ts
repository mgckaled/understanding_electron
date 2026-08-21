import { join } from 'node:path'
import type { DatasetFormat } from '../dataset/format'
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
 * the string verbatim. `encoding` is the fixed set DuckDB's CSV reader
 * builds in — `utf-8`, `utf-16` or `latin-1` — never a value read from
 * user input. `format: 'json'` dispatches to `read_json_auto` instead
 * (D18E.1/D18E.5) — it covers array and newline-delimited JSON on its own
 * (confirmed: Context7, `duckdb-web`), so no separate NDJSON branch, and
 * `encoding` never applies to it (JSON in this app is UTF-8 only).
 * `format: 'excel'` dispatches to `read_xlsx` (D18F.5) — no encoding clause
 * either, for a different reason: a `.xlsx` cell is typed, not raw bytes to
 * decode, so there is no charset ambiguity to begin with.
 *
 * @throws When `hash` is not a 64-char lowercase hex string.
 */
export function buildViewSqlInterpolated(
  hash: string,
  attachmentsDir: string,
  format: DatasetFormat,
  encoding?: 'latin-1'
): string {
  if (!isValidHash(hash)) throw new Error(`invalid attachment hash: ${hash}`)
  const path = sqlPath(join(attachmentsDir, hash))
  if (format === 'json') {
    return `CREATE OR REPLACE VIEW dataset AS SELECT * FROM read_json_auto('${path}')`
  }
  if (format === 'excel') {
    return `CREATE OR REPLACE VIEW dataset AS SELECT * FROM read_xlsx('${path}', header = true)`
  }
  const encodingClause = encoding ? `, encoding = '${encoding}'` : ''
  return `CREATE OR REPLACE VIEW dataset AS SELECT * FROM read_csv_auto('${path}'${encodingClause})`
}

// Matches DuckDB's own wording for a plain (utf-8) CSV read that hits a byte
// sequence the decoder rejects — measured against the real engine, not
// guessed from the error text. See HISTORY.md for the encoding fix this
// backs and why `latin-1` is not a can't-fail retry.
const UTF8_ENCODING_ERROR_PATTERN = /this file is not utf-8 encoded/i

export function isUtf8EncodingError(message: string): boolean {
  return UTF8_ENCODING_ERROR_PATTERN.test(message)
}

/**
 * Creates or refreshes the `dataset` view, retrying once with
 * `encoding = 'latin-1'` when a delimited read fails on invalid UTF-8.
 * `knownEncoding` skips straight to that retry for a hash this worker
 * already classified — the file's bytes never change (content-addressed),
 * so the same file never needs classifying twice. If the retry itself
 * throws (measured: DuckDB's `latin-1` decoder rejects some byte sequences
 * too, so it is not a can't-fail fallback), the *original* utf-8 error
 * propagates — it names the real problem, the retry's own error does not.
 * `format: 'json'` and `format: 'excel'` both skip the encoding dance
 * entirely (D18E.5, D18F.5) — a single `read_json_auto`/`read_xlsx` call,
 * never retried.
 *
 * @param run - Executes one SQL statement against the live connection;
 *   injected so this stays testable without a real DuckDB instance.
 * @returns The encoding the view ended up using, for the caller to cache.
 */
export async function ensureDatasetView(params: {
  hash: string
  attachmentsDir: string
  format: DatasetFormat
  knownEncoding: 'latin-1' | undefined
  run: (sql: string) => Promise<unknown>
}): Promise<'latin-1' | undefined> {
  const { hash, attachmentsDir, format, knownEncoding, run } = params

  if (format === 'json' || format === 'excel') {
    await run(buildViewSqlInterpolated(hash, attachmentsDir, format))
    return undefined
  }

  try {
    await run(buildViewSqlInterpolated(hash, attachmentsDir, format, knownEncoding))
    return knownEncoding
  } catch (error) {
    if (knownEncoding || !isUtf8EncodingError((error as Error).message)) throw error
    try {
      await run(buildViewSqlInterpolated(hash, attachmentsDir, format, 'latin-1'))
    } catch {
      throw error
    }
    return 'latin-1'
  }
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
