import { copyFile, mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'

// Content-addressed blob store (D16.3): userData/attachments/<hash>, no
// extension — the type lives on the MessagePart, not the filesystem. Generic
// on purpose (plano 16's mechanism, dataset its first consumer): nothing here
// knows about CSVs.

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** Copies `sourcePath` to `<dir>/<hash>` unless it is already there — the second attach of the same file costs a stat, not a copy. */
export async function ensureAttachment(
  dir: string,
  hash: string,
  sourcePath: string
): Promise<void> {
  await mkdir(dir, { recursive: true })
  const target = join(dir, hash)
  if (await exists(target)) return
  await copyFile(sourcePath, target)
}

/** Every hash currently stored under `dir` — the disk side of the D16.2 sweep. */
export async function storedHashes(dir: string): Promise<string[]> {
  try {
    return await readdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

/**
 * Deletes every blob under `dir` whose hash is not in `referenced`.
 *
 * @param referenced - The current global reference set (D16.2's json_each
 *   sweep) — not scoped to one conversation, so a blob shared by two survives
 *   either one's removal.
 */
export async function sweepUnreferenced(
  dir: string,
  referenced: ReadonlySet<string>
): Promise<void> {
  const stored = await storedHashes(dir)
  const orphaned = stored.filter((hash) => !referenced.has(hash))
  // A failed unlink (e.g. Windows EBUSY on a handle still open) is swallowed:
  // the sweep is re-runnable, so a leftover orphan is recoverable and
  // reporting a failed removal for what the rest of the sweep did successfully
  // is not.
  await Promise.all(orphaned.map((hash) => unlink(join(dir, hash)).catch(() => {})))
}
