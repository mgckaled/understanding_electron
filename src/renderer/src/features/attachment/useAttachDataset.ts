import { useCallback, useState } from 'react'
import type { DatasetPart, JobId } from '@shared/ipc'
import { useAsyncAction } from '../../shared/hooks/useAsyncAction'
import { useJobProgress } from '../../shared/hooks/useJobProgress'
import type { ViewState } from '../../shared/ui/state'

/**
 * Picks a file and turns it into a {@link DatasetPart} — the mechanism of the
 * fase 06 scanner, reused (D16.6). `onAttached` lifts the finished part to the
 * caller and this hook's own state resets to idle right after: the pending
 * attachment lives ONE place (the composer, next to the draft), not here too.
 */
export function useAttachDataset(onAttached: (part: DatasetPart) => void): {
  state: ViewState<DatasetPart>
  pick: () => Promise<void>
  cancel: () => void
} {
  const { state, run, setProgress, reset } = useAsyncAction<DatasetPart>()
  const [jobId, setJobId] = useState<JobId | null>(null)

  useJobProgress(jobId, setProgress)

  const pick = useCallback(async (): Promise<void> => {
    const picked = await window.api.dataset.pick()

    if (!picked.ok) {
      await run(() => Promise.resolve(picked))
      return
    }
    if (picked.value === null) return // user closed the dialog — stay idle

    const path = picked.value.path
    const newJobId = crypto.randomUUID()
    setJobId(newJobId)
    const result = await run(() => window.api.dataset.attach(path, newJobId))
    setJobId(null)

    if (result.ok) {
      onAttached(result.value)
      reset()
    }
  }, [run, reset, onAttached])

  const cancel = useCallback((): void => {
    if (jobId !== null) void window.api.job.cancel(jobId)
  }, [jobId])

  return { state, pick, cancel }
}
