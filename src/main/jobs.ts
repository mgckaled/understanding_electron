import type { JobId } from '@shared/ipc'

const controllers = new Map<JobId, AbortController>()

export function create(jobId: JobId): AbortController {
  const controller = new AbortController()
  controllers.set(jobId, controller)
  return controller
}

export function cancel(jobId: JobId): void {
  controllers.get(jobId)?.abort()
}

export function finish(jobId: JobId): void {
  controllers.delete(jobId)
}

export function list(): JobId[] {
  return [...controllers.keys()]
}
