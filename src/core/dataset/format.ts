export type DatasetFormat = 'delimited' | 'json' | 'excel'

const BOM = '﻿'

// .xlsx is a ZIP container — its first 4 bytes are the ZIP local-file-header
// signature "PK\x03\x04" (D18F.3), never text to decode.
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04])

/**
 * Detects the dataset format from its content, not its file extension (D18E.1).
 *
 * Checks the ZIP signature before UTF-8 decoding because .xlsx files are
 * binary ZIP containers (D18F.3). For text formats, strips a leading BOM
 * before inspecting the first non-whitespace character to distinguish JSON
 * from delimited data.
 */
export function sniffDatasetFormat(sample: Buffer): DatasetFormat {
  if (sample.subarray(0, ZIP_SIGNATURE.length).equals(ZIP_SIGNATURE)) return 'excel'

  const text = sample.toString('utf8')
  const withoutBom = text.startsWith(BOM) ? text.slice(BOM.length) : text
  const firstChar = withoutBom.trimStart().charAt(0)
  return firstChar === '{' || firstChar === '[' ? 'json' : 'delimited'
}
