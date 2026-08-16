import type { createHash } from 'node:crypto'
import { StringDecoder } from 'node:string_decoder'

/**
 * Splits a raw byte stream into lines while feeding every chunk to `hash`
 * exactly once — the read that pays for both the digest and the scan (D16.6).
 *
 * @param chunks - Raw bytes, in order. Decoded through `StringDecoder`, not a
 *   per-chunk `toString('utf8')`: the latter corrupts any multi-byte
 *   character split at a chunk boundary (`endereço` → `endere` + U+FFFD +
 *   `o`), silently, which a Portuguese header hits often (verified: Context7).
 * @param hash - Mutated via `update()` as chunks arrive; `digest()` on it is
 *   only meaningful after this generator is fully consumed.
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
