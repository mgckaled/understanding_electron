import { useCallback, useState } from 'react'
import type { DatasetRef, JobId, Result } from '@shared/ipc'
import { useAsyncAction } from '../../shared/hooks/useAsyncAction'
import { useJobProgress } from '../../shared/hooks/useJobProgress'
import type { ViewState } from '../../shared/ui/state'

/** The pick/attach pair a category's IPC surface exposes — dataset, document and image share this shape (D17.1). */
type AttachApi<T> = {
  pick: () => Promise<Result<DatasetRef | null>>
  attach: (path: string, jobId: JobId) => Promise<Result<T>>
}

/**
 * Picks a file through `api` and turns it into an attachment part — the
 * mechanism of the fase 06 scanner, generalized (D17.4) so the composer's one
 * pending slot is driven by a single state machine regardless of category:
 * `api` is chosen by the caller at call time, not baked into the hook, so one
 * instance serves every popover item. `onAttached` lifts the finished part to
 * the caller and this hook's own state resets to idle right after: the
 * pending attachment lives ONE place (the composer, next to the draft), not
 * here too.
 */
export function useAttachFile<T>(onAttached: (part: T) => void): {
  state: ViewState<T>
  /**
   * `onPicked`, when given, runs right after a successful pick and before the
   * attach job opens (D17.10) — the caller's chance to read `sizeBytes` and
   * refine the progress label before `state.status` turns 'loading'.
   */
  pick: (api: AttachApi<T>, onPicked?: (ref: DatasetRef) => void) => Promise<void>
  cancel: () => void
} {
  const { state, run, setProgress, reset } = useAsyncAction<T>()
  const [jobId, setJobId] = useState<JobId | null>(null)

  useJobProgress(jobId, setProgress)

  const pick = useCallback(
    async (api: AttachApi<T>, onPicked?: (ref: DatasetRef) => void): Promise<void> => {
      const picked = await api.pick()

      if (!picked.ok) {
        await run(() => Promise.resolve(picked))
        return
      }
      if (picked.value === null) return // user closed the dialog — stay idle

      onPicked?.(picked.value)

      const path = picked.value.path
      const newJobId = crypto.randomUUID()
      setJobId(newJobId)
      const result = await run(() => api.attach(path, newJobId))
      setJobId(null)

      if (result.ok) {
        onAttached(result.value)
        reset()
      }
    },
    [run, reset, onAttached]
  )

  const cancel = useCallback((): void => {
    if (jobId !== null) void window.api.job.cancel(jobId)
  }, [jobId])

  return { state, pick, cancel }
}
