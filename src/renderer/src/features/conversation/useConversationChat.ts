import { useCallback, useRef, useState } from 'react'
import type {
  AiService,
  AttachmentPart,
  ChatReply,
  ConversationSettings,
  JobId,
  Message,
  MessagePart
} from '@shared/ipc'
import { calibrateRatio, DEFAULT_CHARS_PER_TOKEN } from '@core/ai/budget'
import { imageCountOf, toChatMessages } from '@core/ai/messages'
import { useAsyncAction } from '../../shared/hooks/useAsyncAction'
import { useJobChunks } from '../../shared/hooks/useJobChunks'
import { useJobReasoning } from '../../shared/hooks/useJobReasoning'
import type { ViewState } from '../../shared/ui/state'
import { stoppedFromError } from './conversations'
import { useActiveConversation, useConversations } from './conversationsContext'

/**
 * Streams the model's reply to the active conversation, committing only the
 * finished turn to the store — the streaming text is kept out of it (D13.2).
 *
 * @param service - Which provider `model` belongs to (N-1-B); recorded
 *   alongside `model` in the pair the first send locks (D15.13).
 * @param model - `null` when the machine has no model installed (D15.2); the
 *   caller must guard, since there is then no model to address the call to.
 * @param numCtx - Context window this conversation reserves (D15.2). Undefined
 *   lets Ollama decide, which here is 4096 — a number nobody chose.
 */
export function useConversationChat(
  service: AiService,
  model: string | null,
  numThread?: number,
  numCtx?: number
): {
  streaming: string
  /** Live reasoning trace for the in-flight turn, cleared with `streaming` (arco 21). */
  streamingReasoning: string
  /**
   * The conversation the last request addressed. Deliberately not cleared when
   * it ends: its loading, error and cancelled state belong to that conversation
   * too, so switching away takes the whole in-flight surface, not just the text.
   */
  lastRequestId: string | null
  state: ViewState<ChatReply>
  /**
   * This conversation's own chars-per-token density, an exponential moving
   * average advanced once per SETTLED turn (21-C-A) — not recomputed every
   * render, which would re-blend once per streaming chunk and evaporate the
   * smoothing before a turn even finishes.
   */
  charsPerToken: number
  send: (
    prompt: string,
    attachment: AttachmentPart | null,
    wantsReasoning?: boolean
  ) => Promise<void>
  cancel: () => void
} {
  const { activeId, create, append, updateSettings } = useConversations()
  // History comes from the transcript query now, not a list carrying every message (D14.1).
  const active = useActiveConversation()
  const [streaming, setStreaming] = useState('')
  const [streamingReasoning, setStreamingReasoning] = useState('')
  const [lastRequestId, setLastRequestId] = useState<string | null>(null)
  // undefined, not DEFAULT_CHARS_PER_TOKEN: the default is only a display
  // fallback (applied at the return below) — seeding it here would make
  // calibrateRatio blend the very first real sample toward it instead of
  // accepting the sample outright.
  const [charsPerToken, setCharsPerToken] = useState<number | undefined>(undefined)
  // This hook does not remount on conversation switch (lastRequestId's own
  // docstring above says so, on purpose, for the in-flight surface) — so
  // without this, conversation A's density would decay into B's estimate
  // (0.6ⁿ per turn) instead of B starting fresh. Same render-time
  // state-compare as `prevThinking` in ReasoningDisclosure.tsx (21-B).
  const [prevActiveId, setPrevActiveId] = useState(activeId)
  if (activeId !== prevActiveId) {
    setPrevActiveId(activeId)
    setCharsPerToken(undefined)
  }
  const [jobId, setJobId] = useState<JobId | null>(null)
  const { state, run } = useAsyncAction<ChatReply>()

  // The accumulated text also lives in a ref, and that is NOT duplication:
  // `send` captures `streaming` from its render, so at settle time the closure
  // holds an empty string. The ref is read at settle; state is what re-renders.
  const partialRef = useRef('')
  const reasoningPartialRef = useRef('')
  useJobChunks(jobId, (text) => {
    partialRef.current += text
    setStreaming(partialRef.current)
  })
  useJobReasoning(jobId, (text) => {
    reasoningPartialRef.current += text
    setStreamingReasoning(reasoningPartialRef.current)
  })

  const clearStreaming = useCallback((): void => {
    partialRef.current = ''
    reasoningPartialRef.current = ''
    setStreaming('')
    setStreamingReasoning('')
  }, [])

  const send = useCallback(
    async (
      prompt: string,
      attachment: AttachmentPart | null,
      wantsReasoning = false
    ): Promise<void> => {
      const text = prompt.trim()
      if (text === '') return
      // Nothing installed: there is no model to address the call to. The
      // composer is already disabled in this state, so this is the guard behind
      // the guard rather than the user-facing one.
      if (model === null) return

      // A conversation exists before there is any reply (D13.9). Typing into an
      // empty app creates one instead of demanding the user make one first.
      const conversationId = activeId ?? create()

      // Writes only what is MISSING (D15.13): both the first-send lock and the
      // one-time backfill for a conversation that predates it, never rewriting a
      // pair already recorded. `service` writes atomically with `model` — they
      // describe the same locked choice (N-1-B), never independently.
      const recorded = conversationId === active?.id ? active.settings : {}
      const pair: ConversationSettings = {
        ...(recorded.model === undefined ? { model, service } : {}),
        ...(recorded.numCtx === undefined && numCtx !== undefined ? { numCtx } : {})
      }
      if (Object.keys(pair).length > 0) updateSettings(conversationId, pair)
      // A conversation just created by the line above is not the active one
      // yet, and its history is empty by definition — comparing the ids is what
      // keeps the previous conversation's turns out of a brand new one.
      const previous = conversationId === active?.id ? active.messages : []
      const parts: MessagePart[] =
        attachment === null ? [{ kind: 'text', text }] : [attachment, { kind: 'text', text }]
      // id/createdAt are placeholders toChatMessages never reads.
      const draftMessage: Message = { id: 'draft', role: 'user', parts, createdAt: 0 }
      // ai:chat now carries Message[] (D17.5) — main materializes it, since a
      // future image part needs bytes this sandboxed renderer cannot read.
      // toChatMessages stays useful here regardless: it is still how sentChars
      // is measured, on the exact payload this call is about to send.
      const history: Message[] = [...previous, draftMessage]
      // Measured HERE, on the payload, and not recomputed from the transcript
      // afterwards: by then the transcript also holds the reply, which this call
      // did not send (D15.14).
      const sentChars = toChatMessages(history).reduce(
        (total, message) => total + message.content.length,
        0
      )

      append(conversationId, { role: 'user', parts })
      clearStreaming()
      setLastRequestId(conversationId)

      const newJobId = crypto.randomUUID()
      setJobId(newJobId)
      const result = await run(() =>
        window.api.ai.chat(
          { service, model, messages: history, numThread, numCtx, wantsReasoning },
          newJobId
        )
      )
      setJobId(null)
      const partial = partialRef.current
      const reasoningPartial = reasoningPartialRef.current
      clearStreaming()

      if (result.ok) {
        // What the meter calibrates on: chars out, and the count the provider
        // returned for them. `sentChars` misses the template's markers, so the
        // ratio comes out low and the estimate high — the safe direction. A
        // turn carrying an image is skipped entirely (D17.12): its flat token
        // cost would poison the ratio for every turn after, char-based or not.
        if (result.value.promptTokens !== undefined && imageCountOf(history) === 0) {
          const promptTokens = result.value.promptTokens
          setCharsPerToken((previous) => calibrateRatio(sentChars, promptTokens, previous))
        }
        // Reasoning rides ahead of text, never resent to a provider (D21A.3) —
        // it is a MessagePart, not a ChatReply field a second call reads back.
        const replyParts: MessagePart[] =
          result.value.reasoning === undefined
            ? [{ kind: 'text', text: result.value.content }]
            : [
                { kind: 'reasoning', text: result.value.reasoning },
                { kind: 'text', text: result.value.content }
              ]
        // Addressed to the conversation captured at send time, never whichever is
        // active when the reply lands: switching mid-stream must not drop the
        // answer into the wrong transcript. Model is on the message (D13.4).
        append(conversationId, {
          role: 'assistant',
          parts: replyParts,
          model,
          // A resolved call, not an interrupted one (21-C-B) — the window
          // filled mid-generation, but the provider still answered normally.
          ...(result.value.stopped === undefined ? {} : { stopped: result.value.stopped })
        })
        return
      }

      // An interrupted reply keeps what arrived, marked (D14.3). Deciding this
      // in the renderer costs no contract change: main returns err() with no
      // payload, and it does not need one — the text is already here.
      const stopped = stoppedFromError(result.error)
      // Interrupted before the first token of EITHER kind writes NOTHING: an
      // empty assistant message is noise, not honesty. A turn cancelled mid
      // reasoning, before any content arrived, still has something worth
      // keeping (D21A, Passo 5).
      if (stopped === null || (partial === '' && reasoningPartial === '')) return
      const interruptedParts: MessagePart[] =
        reasoningPartial === ''
          ? [{ kind: 'text', text: partial }]
          : [
              { kind: 'reasoning', text: reasoningPartial },
              { kind: 'text', text: partial }
            ]
      append(conversationId, {
        role: 'assistant',
        parts: interruptedParts,
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
      service,
      model,
      numThread,
      numCtx,
      run
    ]
  )

  const cancel = useCallback((): void => {
    if (jobId !== null) void window.api.job.cancel(jobId)
  }, [jobId])

  return {
    streaming,
    streamingReasoning,
    lastRequestId,
    state,
    charsPerToken: charsPerToken ?? DEFAULT_CHARS_PER_TOKEN,
    send,
    cancel
  }
}
