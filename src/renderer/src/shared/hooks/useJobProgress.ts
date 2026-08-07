import { useEffect, useRef } from 'react'
import type { JobId, JobProgress } from '@shared/ipc'

export function useJobProgress(
  jobId: JobId | null,
  onProgress: (progress: JobProgress) => void
): void {
  // onProgress kept in a ref so the effect below depends only on jobId — an
  // unmemoized caller would otherwise resubscribe on every render.
  const onProgressRef = useRef(onProgress)
  useEffect(() => {
    onProgressRef.current = onProgress
  })

  useEffect(() => {
    if (jobId === null) return

    return window.api.job.onEvent((event) => {
      if (event.jobId === jobId && event.type === 'progress') {
        onProgressRef.current(event)
      }
    })
  }, [jobId])
}
