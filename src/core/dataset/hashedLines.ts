import type { createHash } from 'node:crypto'
import { StringDecoder } from 'node:string_decoder'

/**
 * Splits a raw byte stream into lines while hashing each chunk exactly once
 * (D16.6).
 *
 * @param chunks - Raw bytes in order, decoded with `StringDecoder` to preserve
 *   multi-byte UTF-8 characters across chunk boundaries.
 * @param hash - Updated as chunks arrive; `digest()` is only valid after the
 *   generator is fully consumed.
 */
export async function* hashedLines(
  chunks: AsyncIterable<Buffer>,
  hash: ReturnType<typeof createHash>
): AsyncGenerator<string> {
  const decoder = new StringDecoder('utf8')
  let buffer = ''

  for await (const chunk of chunks) {
    hash.update(chunk)
    buffer += decoder.write(chunk)

    let newlineIndex: number
    while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newlineIndex)
      yield line.endsWith('\r') ? line.slice(0, -1) : line
      buffer = buffer.slice(newlineIndex + 1)
    }
  }

  buffer += decoder.end()
  if (buffer.length > 0) yield buffer
}

/**
 * Hashes a raw byte stream without text decoding (D18F.4).
 *
 * @param hash - Updated as chunks arrive; `digest()` is only valid after this
 *   promise resolves.
 */
export async function hashFile(
  chunks: AsyncIterable<Buffer>,
  hash: ReturnType<typeof createHash>
): Promise<void> {
  for await (const chunk of chunks) {
    hash.update(chunk)
  }
}
