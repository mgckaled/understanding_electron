import { useCallback, useState } from 'react'
import type { DatasetSummary, JobId } from '@shared/ipc'
import { useAsyncAction } from '../../shared/hooks/useAsyncAction'
import { useJobProgress } from '../../shared/hooks/useJobProgress'
import type { ViewState } from '../../shared/ui/state'

export function useOpenDataset(): {
  state: ViewState<DatasetSummary>
  pick: () => Promise<void>
  cancel: () => void
} {
  const { state, run, setProgress } = useAsyncAction<DatasetSummary>()
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
    await run(() => window.api.dataset.scan(path, newJobId))
    setJobId(null)
  }, [run])

  const cancel = useCallback((): void => {
    if (jobId !== null) void window.api.job.cancel(jobId)
  }, [jobId])

  return { state, pick, cancel }
}
