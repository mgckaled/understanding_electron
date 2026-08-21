export type DatasetFormat = 'delimited' | 'json'

const BOM = '﻿'

/**
 * Detects a dataset's format from its own bytes — never a file extension or
 * a new IPC parameter (D18E.1). The same function runs on both sides of the
 * attach/query boundary, over identical content-addressed bytes, so main and
 * worker cannot disagree about the same hash.
 *
 * A leading BOM (U+FEFF) survives `String.prototype.trimStart()` — it was
 * removed from Unicode's `White_Space` property in version 6.3, so
 * `trimStart` never treated it as whitespace — and must be stripped before
 * inspecting the next character, or a BOM-prefixed JSON file silently reads
 * as delimited.
 */
export function sniffDatasetFormat(sample: string): DatasetFormat {
  const withoutBom = sample.startsWith(BOM) ? sample.slice(BOM.length) : sample
  const firstChar = withoutBom.trimStart().charAt(0)
  return firstChar === '{' || firstChar === '[' ? 'json' : 'delimited'
}
