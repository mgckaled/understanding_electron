import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiAvailability, ChatMessage, ChatReply, JobId } from '@shared/ipc'
import { toChatMessages } from '@core/ai/messages'
import { useAsyncAction } from '../../shared/hooks/useAsyncAction'
import { useJobChunks } from '../../shared/hooks/useJobChunks'
import type { ViewState } from '../../shared/ui/state'
import { stoppedFromError } from './conversations'
import { useActiveConversation, useConversations } from './conversationsContext'

const SERVICE = 'ollama' as const

/*
 * The turns come from the store; the streaming text does NOT (D13.2). Only the
 * finished turn is committed. Without that split every token would re-render
 * the conversation list — not a premature optimisation, just not undoing what
 * the fatia-1 hook already had right.
 */
export function useConversationChat(
  /**
   * `null` means the machine has no model installed at all (D15.2). It is a
   * parameter and not an assumption because the alternative — defaulting to a
   * name — is exactly what let the app send `gemma3:4b` to an Ollama that had
   * never pulled it, and get back a generic upstream error.
   */
  model: string | null,
  numThread?: number,
  /**
   * The context window this conversation reserves (D15.2). Undefined lets
   * Ollama decide, which on this machine is 4096 — a number nobody chose, and
   * one a single 8k-token document overflows on its own.
   */
  numCtx?: number
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
  /**
   * `prompt_eval_count` from the last reply — the exact number of tokens the
   * provider actually read. The only exact count available anywhere, and what
   * calibrates the meter's estimate from the second turn on (D15.4).
   */
  lastPromptTokens: number | undefined
  send: (prompt: string) => Promise<void>
  cancel: () => void
} {
  const { activeId, create, append, updateSettings } = useConversations()
  // The history now comes from the transcript query rather than from a list
  // that carried every message inside it (D14.1).
  const active = useActiveConversation()
  const [availability, setAvailability] = useState<ViewState<AiAvailability>>({ status: 'loading' })
  const [streaming, setStreaming] = useState('')
  const [lastRequestId, setLastRequestId] = useState<string | null>(null)
  const [lastPromptTokens, setLastPromptTokens] = useState<number | undefined>(undefined)
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

  /*
   * The accumulated text also lives in a ref, and that is not duplication.
   * `send` captures `streaming` from the render it was created in, so by the
   * time the request settles the closure holds an empty string — the very text
   * D14.3 says to save would be the one thing not reachable. The ref is read at
   * settle time; the state is what re-renders the view.
   */
  const partialRef = useRef('')
  useJobChunks(jobId, (text) => {
    partialRef.current += text
    setStreaming(partialRef.current)
  })

  const clearStreaming = useCallback((): void => {
    partialRef.current = ''
    setStreaming('')
  }, [])

  const send = useCallback(
    async (prompt: string): Promise<void> => {
      const text = prompt.trim()
      if (text === '') return
      // Nothing installed: there is no model to address the call to. The
      // composer is already disabled in this state, so this is the guard behind
      // the guard rather than the user-facing one.
      if (model === null) return

      // A conversation exists before there is any reply (D13.9). Typing into an
      // empty app creates one instead of demanding the user make one first.
      const conversationId = activeId ?? create()
      // A conversation born here has empty settings, so it would fall back to
      // the catalog's first model on reopen — while its transcript says it was
      // answered by whatever was selected. Recording the model now keeps the
      // row and the messages telling the same story.
      if (activeId === null) updateSettings(conversationId, { model })
      // A conversation just created by the line above is not the active one
      // yet, and its history is empty by definition — comparing the ids is what
      // keeps the previous conversation's turns out of a brand new one.
      const previous = conversationId === active?.id ? active.messages : []
      const history: ChatMessage[] = [...toChatMessages(previous), { role: 'user', content: text }]

      append(conversationId, { role: 'user', parts: [{ kind: 'text', text }] })
      clearStreaming()
      setLastRequestId(conversationId)

      const newJobId = crypto.randomUUID()
      setJobId(newJobId)
      const result = await run(() =>
        window.api.ai.chat(
          { service: SERVICE, model, messages: history, numThread, numCtx },
          newJobId
        )
      )
      setJobId(null)
      const partial = partialRef.current
      clearStreaming()

      if (result.ok) {
        // The exact token count of what was just read. Kept so the meter can
        // stop guessing: dividing the characters that were sent by this gives
        // the real density of THIS conversation. Absent from a provider that
        // does not report it, and the meter falls back to the generic ratio.
        setLastPromptTokens(result.value.promptTokens)
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
        return
      }

      // An interrupted reply keeps what arrived, marked (D14.3). Deciding this
      // in the renderer costs no contract change: main returns err() with no
      // payload, and it does not need one — the text is already here.
      const stopped = stoppedFromError(result.error)
      // Interrupted before the first token writes NOTHING: an empty assistant
      // message is noise, not honesty.
      if (stopped === null || partial === '') return
      append(conversationId, {
        role: 'assistant',
        parts: [{ kind: 'text', text: partial }],
        model,
        stopped
      })
    },
    [
      activeId,
      active,
      create,
      append,
      updateSettings,
      clearStreaming,
      model,
      numThread,
      numCtx,
      run
    ]
  )

  const cancel = useCallback((): void => {
    if (jobId !== null) void window.api.job.cancel(jobId)
  }, [jobId])

  return { availability, streaming, lastRequestId, state, lastPromptTokens, send, cancel }
}
