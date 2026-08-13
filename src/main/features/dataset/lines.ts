import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

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
