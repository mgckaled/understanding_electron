import { useCallback, useEffect, useState } from 'react'
import type { AiAvailability, ChatMessage, ChatReply, JobId } from '@shared/ipc'
import { useAsyncAction } from '../../shared/hooks/useAsyncAction'
import { useJobChunks } from '../../shared/hooks/useJobChunks'
import type { ViewState } from '../../shared/ui/state'

const SERVICE = 'ollama' as const

export function useAiChat(
  model: string,
  numThread?: number
): {
  availability: ViewState<AiAvailability>
  turns: ChatMessage[]
  streaming: string
  state: ViewState<ChatReply>
  send: (prompt: string) => Promise<void>
  cancel: () => void
} {
  const [availability, setAvailability] = useState<ViewState<AiAvailability>>({ status: 'loading' })
  const [turns, setTurns] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState('')
  const [jobId, setJobId] = useState<JobId | null>(null)
  const { state, run } = useAsyncAction<ChatReply>()

  useEffect(() => {
    let active = true
    void window.api.ai.isAvailable(SERVICE).then((result) => {
      if (!active) return
      setAvailability(
        result.ok
          ? { status: 'ready', data: result.value }
          : { status: 'error', error: result.error }
      )
    })
    return () => {
      active = false
    }
  }, [])

  useJobChunks(jobId, (text) => setStreaming((prev) => prev + text))

  const send = useCallback(
    async (prompt: string): Promise<void> => {
      const text = prompt.trim()
      if (text === '') return

      const history: ChatMessage[] = [...turns, { role: 'user', content: text }]
      setTurns(history)
      setStreaming('')

      const newJobId = crypto.randomUUID()
      setJobId(newJobId)
      const result = await run(() =>
        window.api.ai.chat({ service: SERVICE, model, messages: history, numThread }, newJobId)
      )
      setJobId(null)
      setStreaming('')

      if (result.ok) {
        setTurns((prev) => [...prev, { role: 'assistant', content: result.value.content }])
      }
    },
    [turns, model, numThread, run]
  )

  const cancel = useCallback((): void => {
    if (jobId !== null) void window.api.job.cancel(jobId)
  }, [jobId])

  return { availability, turns, streaming, state, send, cancel }
}
