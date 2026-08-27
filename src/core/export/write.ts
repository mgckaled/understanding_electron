import { randomBytes } from 'node:crypto'
import { rename as fsRename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AppError, Result } from '@shared/ipc'
import { ok, err } from '@core/result'
import { mapFsError } from '@core/fsError'

/** Waits between rename attempts. Short and rising, for a lock that is passing. */
const BACKOFF_MS = [50, 150, 400]

/** Windows reports a locked destination through any of these (DE1D.3). */
const LOCKED = new Set(['EPERM', 'EACCES', 'EBUSY'])

type Io = {
  rename?: (from: string, to: string) => Promise<void>
  wait?: (ms: number) => Promise<void>
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

function codeOf(error: unknown): string | undefined {
  return error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined
}

/**
 * Writes `data` to `target` without ever leaving it half-written.
 *
 * The temporary file is born in `target`'s own directory: renaming across
 * volumes fails with EXDEV. On Windows the rename is NOT atomic — it is
 * `MoveFileEx`, which honours sharing modes — so a passing lock (Defender, the
 * search indexer) is retried, and a lasting one becomes `file-in-use` rather
 * than the `permission` that `mapFsError` would guess (DE1D.2, DE1D.3).
 *
 * @param io - Injected for the retry test; a real lock is not reproducible.
 * @returns `ok` once `target` holds the new bytes, and `target` untouched otherwise.
 */
export async function writeAtomic(
  target: string,
  data: string | Uint8Array,
  io: Io = {}
): Promise<Result<void>> {
  const rename = io.rename ?? fsRename
  const wait = io.wait ?? sleep
  const temporary = join(dirname(target), `.${randomBytes(6).toString('hex')}.tmp`)

  try {
    await writeFile(temporary, data)
  } catch (error) {
    return err(mapFsError(error, target))
  }

  let last: unknown
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    try {
      await rename(temporary, target)
      return ok(undefined)
    } catch (error) {
      last = error
      if (!LOCKED.has(codeOf(error) ?? '')) break
      if (attempt < BACKOFF_MS.length) await wait(BACKOFF_MS[attempt])
    }
  }

  // Nothing reached `target`, so the temporary is litter — and failing to
  // remove it must not replace the error that explains the failure.
  await unlink(temporary).catch(() => undefined)
  return err(renameError(last, target))
}

function renameError(error: unknown, path: string): AppError {
  return LOCKED.has(codeOf(error) ?? '') ? { kind: 'file-in-use', path } : mapFsError(error, path)
}
