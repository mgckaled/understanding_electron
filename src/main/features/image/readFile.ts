import { readFile } from 'node:fs/promises'

/** Reads an image's whole bytes, abortable via `signal` — injected into {@link attachImage} so it stays testable without disk I/O. */
export function readImageFile(path: string, signal: AbortSignal): Promise<Buffer> {
  return readFile(path, { signal })
}
