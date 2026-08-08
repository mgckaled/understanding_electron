import { useEffect, useRef } from 'react'
import type { JobId } from '@shared/ipc'

// Sibling of useJobProgress: same subscription shape, but filters the 'chunk'
// variant of JobEvent — the streaming-token path the AI layer is the first to
// consume (plano 09, fatia 1).
export function useJobChunks(jobId: JobId | null, onChunk: (text: string) => void): void {
  // onChunk kept in a ref so the effect depends only on jobId — an unmemoized
  // caller would otherwise resubscribe on every render.
  const onChunkRef = useRef(onChunk)
  useEffect(() => {
    onChunkRef.current = onChunk
  })

  useEffect(() => {
    if (jobId === null) return

    return window.api.job.onEvent((event) => {
      if (event.jobId === jobId && event.type === 'chunk') {
        onChunkRef.current(event.text)
      }
    })
  }, [jobId])
}
