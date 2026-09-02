import { useEffect, useRef } from 'react'
import type { JobId } from '@shared/ipc'

// Sibling of useJobChunks: same subscription shape, filters the 'reasoning'
// variant of JobEvent instead (arco 21).
export function useJobReasoning(jobId: JobId | null, onThinking: (text: string) => void): void {
  const onThinkingRef = useRef(onThinking)
  useEffect(() => {
    onThinkingRef.current = onThinking
  })

  useEffect(() => {
    if (jobId === null) return

    return window.api.job.onEvent((event) => {
      if (event.jobId === jobId && event.type === 'reasoning') {
        onThinkingRef.current(event.text)
      }
    })
  }, [jobId])
}
