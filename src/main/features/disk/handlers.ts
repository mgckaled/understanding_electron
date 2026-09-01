import type { DiskUsage, JobEvent, JobId, Result } from '@shared/ipc'
import { measureDiskUsage } from '@core/observatory/disk'
import { mapFsError } from '@core/fsError'
import { ok, err } from '@core/result'
import * as jobs from '../../jobs'

/**
 * Walks `userData/` as a cancellable job (O-5). Only an unreadable root fails
 * the whole call — a subtree that cannot be read marks its `DiskEntry` as
 * `partial` instead (DO5.5), because this metric is best-effort by nature,
 * unlike a domain operation with one success/failure surface.
 */
export async function readDiskUsage(
  { jobId }: { jobId: JobId },
  userDataDir: string,
  getCacheSize: () => Promise<number>,
  emitProgress: (event: JobEvent) => void
): Promise<Result<DiskUsage>> {
  const controller = jobs.create(jobId)

  try {
    const usage = await measureDiskUsage(
      userDataDir,
      getCacheSize,
      controller.signal,
      emitProgress,
      jobId
    )
    if (controller.signal.aborted) return err({ kind: 'cancelled' })
    return ok(usage)
  } catch (error) {
    if (controller.signal.aborted) return err({ kind: 'cancelled' })
    return err(mapFsError(error, userDataDir))
  } finally {
    jobs.finish(jobId)
  }
}
