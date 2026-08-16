import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { hashedLines } from '@core/dataset/hashedLines'

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
