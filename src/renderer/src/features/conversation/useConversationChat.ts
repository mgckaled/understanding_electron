import { useCallback, useEffect, useState } from 'react'
import type { AiAvailability, ChatMessage, ChatReply, JobId } from '@shared/ipc'
import { toChatMessages } from '@core/ai/messages'
import { useAsyncAction } from '../../shared/hooks/useAsyncAction'
import { useJobChunks } from '../../shared/hooks/useJobChunks'
import type { ViewState } from '../../shared/ui/state'
import { useActiveConversation, useConversations } from './conversationsContext'

const SERVICE = 'ollama' as const

/*
 * The turns come from the store; the streaming text does NOT (D13.2). Only the
 * finished turn is committed. Without that split every token would re-render
 * the conversation list — not a premature optimisation, just not undoing what
 * the fatia-1 hook already had right.
 */
export function useConversationChat(
  model: string,
  numThread?: number
): {
  availability: ViewState<AiAvailability>
  streaming: string
  /**
   * The conversation the last request was addressed to. Deliberately not
   * cleared when the request ends: `state` (loading, error, cancelled) belongs
   * to that conversation too, so switching away has to take the whole in-flight
   * surface with it, not just the streaming text.
   */
  lastRequestId: string | null
  state: ViewState<ChatReply>
  send: (prompt: string) => Promise<void>
  cancel: () => void
} {
  const { activeId, create, append } = useConversations()
  // The history now comes from the transcript query rather than from a list
  // that carried every message inside it (D14.1).
  const active = useActiveConversation()
  const [availability, setAvailability] = useState<ViewState<AiAvailability>>({ status: 'loading' })
  const [streaming, setStreaming] = useState('')
  const [lastRequestId, setLastRequestId] = useState<string | null>(null)
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

      // A conversation exists before there is any reply (D13.9). Typing into an
      // empty app creates one instead of demanding the user make one first.
      const conversationId = activeId ?? create()
      // A conversation just created by the line above is not the active one
      // yet, and its history is empty by definition — comparing the ids is what
      // keeps the previous conversation's turns out of a brand new one.
      const previous = conversationId === active?.id ? active.messages : []
      const history: ChatMessage[] = [...toChatMessages(previous), { role: 'user', content: text }]

      append(conversationId, { role: 'user', parts: [{ kind: 'text', text }] })
      setStreaming('')
      setLastRequestId(conversationId)

      const newJobId = crypto.randomUUID()
      setJobId(newJobId)
      const result = await run(() =>
        window.api.ai.chat({ service: SERVICE, model, messages: history, numThread }, newJobId)
      )
      setJobId(null)
      setStreaming('')

      if (result.ok) {
        // Addressed to the conversation captured at send time, never to
        // whichever one is active when the reply lands: switching mid-stream
        // must not drop the answer into the wrong transcript. The model is
        // recorded on the message, which is what keeps authorship readable in
        // a conversation that changed models halfway (D13.4).
        append(conversationId, {
          role: 'assistant',
          parts: [{ kind: 'text', text: result.value.content }],
          model
        })
      }
    },
    [activeId, active, create, append, model, numThread, run]
  )

  const cancel = useCallback((): void => {
    if (jobId !== null) void window.api.job.cancel(jobId)
  }, [jobId])

  return { availability, streaming, lastRequestId, state, send, cancel }
}
