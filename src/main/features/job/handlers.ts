import type { JobId } from '@shared/ipc'
import * as jobs from '../../jobs'

export function cancelJob({ jobId }: { jobId: JobId }): void {
  jobs.cancel(jobId)
}
