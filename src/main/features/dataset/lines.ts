import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { hashedLines } from '@core/dataset/hashedLines'

export async function* readLines(path: string): AsyncGenerator<string> {
  const stream = createReadStream(path)
  // Without this listener, an unhandled 'error' on the stream (ENOENT, EISDIR)
  // crashes the process; the for-await loop below still rejects with that same
  // error — confirmed empirically, see docs/HISTORY.md.
  stream.on('error', () => {})

  const rl = createInterface({ input: stream, crlfDelay: Infinity })
  try {
    for await (const line of rl) {
      yield line
    }
  } finally {
    rl.close()
    // rl.close() releases readline but does NOT destroy the stream (confirmed
    // empirically: bytesRead kept growing after a for-await break), so without
    // this, cancelling a scan would not stop the disk read. See docs/HISTORY.md.
    stream.destroy()
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
