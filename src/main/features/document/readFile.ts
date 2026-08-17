import { readFile, stat } from 'node:fs/promises'

/** Reads a document's whole bytes, abortable via `signal` — injected into {@link attachDocument} so it stays testable without disk I/O. */
export function readDocumentFile(path: string, signal: AbortSignal): Promise<Buffer> {
  return readFile(path, { signal })
}

/** A document's size on disk, for the D17.10 progress estimate — injected into {@link pickDocument} the same way. */
export async function statDocumentSize(path: string): Promise<number> {
  return (await stat(path)).size
}
