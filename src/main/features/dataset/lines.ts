import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

export async function* readLines(path: string): AsyncGenerator<string> {
  const stream = createReadStream(path)
  // Without this listener, an 'error' with no handler on the input stream
  // (e.g. ENOENT, EISDIR) crashes the process. The for-await loop below
  // still rejects with that same error — confirmed empirically, see
  // docs/HISTORY.md.
  stream.on('error', () => {})

  const rl = createInterface({ input: stream, crlfDelay: Infinity })
  try {
    for await (const line of rl) {
      yield line
    }
  } finally {
    rl.close()
  }
}
