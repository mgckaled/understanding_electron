import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Binds a byte-resolver to `dir` — injected into `chat()` so an image part's bytes are read fresh from `userData/attachments/<hash>` on every send (D17.5). */
export function resolveAttachmentBytes(dir: string): (hash: string) => Promise<Buffer> {
  return (hash: string) => readFile(join(dir, hash))
}
