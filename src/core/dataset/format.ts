export type DatasetFormat = 'delimited' | 'json' | 'excel'

const BOM = '﻿'

// .xlsx is a ZIP container — its first 4 bytes are the ZIP local-file-header
// signature "PK\x03\x04" (D18F.3), never text to decode.
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04])

/**
 * Detects a dataset's format from its own bytes — never a file extension or
 * a new IPC parameter (D18E.1). The same function runs on both sides of the
 * attach/query boundary, over identical content-addressed bytes, so main and
 * worker cannot disagree about the same hash.
 *
 * Checks the ZIP signature on the raw bytes first (D18F.3): `.xlsx` is
 * binary, and decoding it as UTF-8 before recognizing it would be both
 * wrong and wasteful. Only once that fails does the sample get decoded, for
 * the existing delimited/JSON check.
 *
 * A leading BOM (U+FEFF) survives `String.prototype.trimStart()` — it was
 * removed from Unicode's `White_Space` property in version 6.3, so
 * `trimStart` never treated it as whitespace — and must be stripped before
 * inspecting the next character, or a BOM-prefixed JSON file silently reads
 * as delimited.
 */
export function sniffDatasetFormat(sample: Buffer): DatasetFormat {
  if (sample.subarray(0, ZIP_SIGNATURE.length).equals(ZIP_SIGNATURE)) return 'excel'

  const text = sample.toString('utf8')
  const withoutBom = text.startsWith(BOM) ? text.slice(BOM.length) : text
  const firstChar = withoutBom.trimStart().charAt(0)
  return firstChar === '{' || firstChar === '[' ? 'json' : 'delimited'
}
