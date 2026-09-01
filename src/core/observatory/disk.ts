import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { DiskEntry, DiskUsage, JobEvent, JobId } from '@shared/ipc'

/**
 * Top-level `userData/` entries this app itself writes (O-5, DO5.4). Anything
 * else at the top level is Chromium's — `observatory.db` and the future RAG
 * index file (`reference/observatory/README.md` § 3.1) join this list when
 * they exist.
 */
const CRIVO_ENTRIES = new Set([
  'crivo.db',
  'crivo.db-wal',
  'crivo.db-shm',
  'attachments',
  'duckdb-tmp'
])

const CHROMIUM_CACHE_DIR = 'Cache'

async function walkBytes(
  dir: string,
  signal: AbortSignal
): Promise<{ bytes: number; partial: boolean }> {
  let bytes = 0
  let partial = false
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return { bytes: 0, partial: true }
  }

  for (const entry of entries) {
    if (signal.aborted) return { bytes, partial }
    const full = join(dir, entry.name)
    try {
      if (entry.isDirectory()) {
        const sub = await walkBytes(full, signal)
        bytes += sub.bytes
        partial = partial || sub.partial
      } else {
        bytes += (await fs.stat(full)).size
      }
    } catch {
      partial = true
    }
  }
  return { bytes, partial }
}

/**
 * Measures `userData/` split by author (O-5). `Cache/` is resolved once via
 * `getCacheSize` instead of walked — measured against the real disk (O-5
 * Passo 0): the two agree within ~5%, the gap being the cache backend's own
 * index and sparse-file overhead, not a bug to chase. `getCacheSize` and
 * `emitProgress` are injected: this module never imports `electron`.
 */
export async function measureDiskUsage(
  userDataDir: string,
  getCacheSize: () => Promise<number>,
  signal: AbortSignal,
  emitProgress: (event: JobEvent) => void,
  jobId: JobId
): Promise<DiskUsage> {
  const topLevel = await fs.readdir(userDataDir, { withFileTypes: true })

  const crivo: DiskEntry[] = []
  let runtimeBytes = 0
  let runtimePartial = false
  let done = 0

  for (const entry of topLevel) {
    if (signal.aborted) break
    emitProgress({ jobId, type: 'progress', phase: 'scanning', done: done++, total: null })

    const full = join(userDataDir, entry.name)

    if (CRIVO_ENTRIES.has(entry.name)) {
      if (entry.isDirectory()) {
        const { bytes, partial } = await walkBytes(full, signal)
        crivo.push({ name: entry.name, bytes, partial })
      } else {
        try {
          crivo.push({ name: entry.name, bytes: (await fs.stat(full)).size, partial: false })
        } catch {
          crivo.push({ name: entry.name, bytes: 0, partial: true })
        }
      }
      continue
    }

    if (entry.name === CHROMIUM_CACHE_DIR) {
      try {
        runtimeBytes += await getCacheSize()
      } catch {
        runtimePartial = true
      }
      continue
    }

    if (entry.isDirectory()) {
      const { bytes, partial } = await walkBytes(full, signal)
      runtimeBytes += bytes
      runtimePartial = runtimePartial || partial
    } else {
      try {
        runtimeBytes += (await fs.stat(full)).size
      } catch {
        runtimePartial = true
      }
    }
  }

  const totalBytes = crivo.reduce((sum, entry) => sum + entry.bytes, 0) + runtimeBytes
  return { crivo, runtimeBytes, runtimePartial, totalBytes }
}
