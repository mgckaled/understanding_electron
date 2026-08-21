import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { open } from 'node:fs/promises'
import { hashedLines } from '@core/dataset/hashedLines'
import { sniffDatasetFormat, type DatasetFormat } from '@core/dataset/format'

// Enough to see past a BOM and any leading whitespace (D18E.1) — never the
// whole file: a multi-GB attachment must not be read into JS to answer "is
// this JSON?" (ESCOPO.md § Escala).
const FORMAT_SNIFF_BYTES = 256

/**
 * Reads a small sample from the start of `path` to sniff its format
 * (D18E.3) — the same detector `workers/duckdb/index.ts` runs against the
 * stored copy, over the original file instead, so `attachDataset` knows
 * which path to take before anything is copied.
 */
export async function sniffFileFormat(path: string): Promise<DatasetFormat> {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(FORMAT_SNIFF_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, FORMAT_SNIFF_BYTES, 0)
    return sniffDatasetFormat(buffer.subarray(0, bytesRead).toString('utf8'))
  } finally {
    await handle.close()
  }
}

/**
 * Reads `path` once, yielding lines and hashing every byte as it streams
 * (D16.6). `digest()` is only meaningful once the returned generator has been
 * fully consumed — cancellation (which stops short) must not call it.
 */
export function readHashedFile(path: string): {
  lines: AsyncGenerator<string>
  digest: () => string
} {
  const stream = createReadStream(path)
  stream.on('error', () => {})
  const hash = createHash('sha256')

  async function* run(): AsyncGenerator<string> {
    try {
      yield* hashedLines(stream, hash)
    } finally {
      stream.destroy()
    }
  }

  return { lines: run(), digest: () => hash.digest('hex') }
}
