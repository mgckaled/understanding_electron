import type { ChatMessage } from '@shared/ipc'
import type { ChatFn, LoadedFn, ModelsFn, ProbeFn, UnloadFn } from '@core/ai/types'
import { UpstreamError } from '@core/ai/types'
import { GEMINI_MODELS } from '@core/ai/models'
import { describeUpstreamError } from '@core/ai/upstreamError'

const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'

// ESCOPO.md normalizes every image to PNG or JPEG, so the first bytes suffice.
function imageMimeType(base64: string): 'image/png' | 'image/jpeg' {
  const [first, second] = Buffer.from(base64.slice(0, 4), 'base64')
  return first === 0x89 && second === 0x50 ? 'image/png' : 'image/jpeg'
}

function contentOf(message: ChatMessage): unknown[] {
  const imageParts = (message.images ?? []).map((data) => ({
    type: 'image',
    mime_type: imageMimeType(data),
    data
  }))
  return [...imageParts, { type: 'text', text: message.content }]
}

// D21D.8.1: a signed reasoning trace is reconstructed as its own `thought`
// step, ahead of the `model_output` step for that same turn — the order the
// stateless Interactions API expects steps concatenated in (D21D.5.1).
function toInteractionsInput(messages: ChatMessage[]): unknown[] {
  return messages
    .filter((message) => message.role !== 'system')
    .flatMap((message): unknown[] => {
      if (message.role !== 'assistant') {
        return [{ type: 'user_input', content: contentOf(message) }]
      }
      const thoughts = (message.reasoningSignatures ?? []).map((signed) => ({
        type: 'thought',
        signature: signed.signature,
        summary: [{ text: signed.text }]
      }))
      return [
        ...thoughts,
        { type: 'model_output', content: [{ type: 'text', text: message.content }] }
      ]
    })
}

function systemInstructionOf(messages: ChatMessage[]): string | undefined {
  return messages.find((message) => message.role === 'system')?.content
}

/**
 * "Available" on the cloud means "there is a key stored" (Peça 9) — never a
 * real ping. Mirrors `makeGlmProbe` (N-1-B).
 */
export function makeGeminiProbe(hasKey: () => boolean): ProbeFn {
  return async () => {
    if (!hasKey()) throw new UpstreamError(null, 'no api key stored')
    return 'gemini-3.7-flash'
  }
}

// Loosely typed on purpose: `event_type` is the only field this parser trusts
// enough to switch on (D21D.3) — everything else is read defensively through
// optional chaining, never assumed present just because one event shape is.
type InteractionsEvent = {
  event_type: string
  index?: number
  step?: {
    type?: string
    signature?: string
    summary?: { text?: string }[]
    content?: { type?: string; text?: string }[]
  }
  // Confirmed live (D21D.1): a thought_summary/thought_signature delta wraps
  // its payload in `content`, matching the same Content-union shape a
  // model_output step uses — not a bare `text`/`signature` field.
  delta?: { type?: string; content?: { text?: string }; text?: string; signature?: string }
  // Confirmed live (D21D.1): `interaction.status_update` carries a bare
  // top-level `status`; `interaction.completed` nests both `status` and the
  // final `usage` under `interaction` instead, with different field names
  // (`total_input_tokens`/`total_output_tokens`, never `usage_metadata`) —
  // two distinct completion-ish event shapes, not one, so both are read.
  status?: string
  interaction?: {
    status?: string
    usage?: { total_input_tokens?: number; total_output_tokens?: number }
  }
  // Ollama/GLM already prove this shape: HTTP 200 with an error object inside
  // the stream body (UpstreamError with status: null). Checked before either
  // contract guard below, so a mid-stream failure reads as what it is, not as
  // "the API contract may have changed."
  error?: unknown
}

type StepAccumulator = {
  type: string
  known: boolean
  signature: string
  reasoningText: string
  contentText: string
}

// D21D.1: incomplete reads directly as "hit the output budget" in the docs
// ("completed, but contains incomplete results, e.g. hitting max_tokens") —
// budget_exceeded is a distinct condition, never collapsed into the same
// label until a live call proves otherwise (see the plan's "Verificação ao
// vivo"). D21D.3: an unrecognized step type is a known extension point
// (function_call, file_search_call, code_execution_call, and whatever the
// provider adds next) — degrade by ignoring it, never abort the turn.
export function makeGeminiChat(getApiKey: () => string | null): ChatFn {
  return async (messages, { model, signal, onChunk, onThinking }) => {
    const apiKey = getApiKey()
    if (apiKey === null) throw new UpstreamError(null, 'no api key stored')

    const systemInstruction = systemInstructionOf(messages)
    const response = await fetch(GEMINI_INTERACTIONS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        model,
        input: toInteractionsInput(messages),
        store: false,
        stream: true,
        ...(systemInstruction === undefined ? {} : { system_instruction: systemInstruction }),
        generation_config: {
          thinking_level: 'low',
          thinking_summaries: onThinking !== undefined ? 'auto' : 'none'
        }
      }),
      signal
    })

    if (!response.ok || response.body === null) {
      const body = await response.text().catch(() => '')
      console.error(`[gemini] HTTP ${response.status}`, body)
      throw new UpstreamError(response.status, describeUpstreamError(response.status, body))
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const steps = new Map<number, StepAccumulator>()
    let buffer = ''
    let promptTokens: number | undefined
    let evalTokens: number | undefined
    let stopped: 'context-exhausted' | undefined
    let sawBudgetExceeded = false

    function stepFor(index: number, type: string): StepAccumulator {
      let step = steps.get(index)
      if (step === undefined) {
        const known = type === 'thought' || type === 'model_output'
        if (!known) console.error(`[gemini] unknown step type: ${type}, ignoring`)
        step = { type, known, signature: '', reasoningText: '', contentText: '' }
        steps.set(index, step)
      }
      return step
    }

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE: one "data: {...}" event per line — same discipline as
        // glm.ts's parser (a socket read can split one line across chunks).
        let newline: number
        while ((newline = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newline).trim()
          buffer = buffer.slice(newline + 1)
          if (line === '' || !line.startsWith('data: ')) continue

          const payload = line.slice('data: '.length)
          // A non-JSON payload (a `[DONE]` sentinel, a keep-alive) is
          // protocol noise, not a shape mismatch (D21D.3, grau 1) — the last
          // thing this parser should do is crash a turn that already
          // streamed real content over something it was never meant to read.
          let event: InteractionsEvent
          try {
            event = JSON.parse(payload) as InteractionsEvent
          } catch {
            console.error(`[gemini] non-JSON data line, ignoring: ${payload}`)
            continue
          }

          if (event.error !== undefined) {
            console.error('[gemini] mid-stream error', event.error)
            throw new UpstreamError(null, describeUpstreamError(null, payload))
          }

          if (event.event_type === 'step.start' && event.index !== undefined) {
            const type = event.step?.type ?? 'unknown'
            const step = stepFor(event.index, type)
            if (step.known && type === 'thought') {
              step.signature = event.step?.signature ?? ''
              const summary = (event.step?.summary ?? []).map((part) => part.text ?? '').join('')
              if (summary !== '') {
                step.reasoningText += summary
                onThinking?.(summary)
              }
            } else if (step.known && type === 'model_output') {
              const text = (event.step?.content ?? [])
                .filter((part) => part.type === 'text' || part.type === undefined)
                .map((part) => part.text ?? '')
                .join('')
              if (text !== '') {
                step.contentText += text
                onChunk?.(text)
              }
            }
            continue
          }

          if (event.event_type === 'step.delta' && event.index !== undefined) {
            const step = steps.get(event.index)
            if (step === undefined || !step.known) continue
            const delta = event.delta
            const deltaSignature = delta?.signature
            const deltaText = delta?.content?.text ?? delta?.text
            if (delta?.type === 'thought_signature' && deltaSignature !== undefined) {
              step.signature = deltaSignature
            } else if (delta?.type === 'thought_summary' && deltaText !== undefined) {
              step.reasoningText += deltaText
              onThinking?.(deltaText)
            } else if (step.type === 'model_output' && deltaText !== undefined) {
              step.contentText += deltaText
              onChunk?.(deltaText)
            } else {
              // Diagnostic only (D21D.3 grau 1 spirit) — the real delta
              // sub-type/field names are not confirmed live yet, so surface
              // whatever shows up instead of silently doing nothing with it.
              console.error(`[gemini] unrecognized step.delta shape: ${JSON.stringify(delta)}`)
            }
            continue
          }

          // A step closes explicitly (confirmed live) — finalization already
          // happens once at the end of the stream below, so there is nothing
          // to do here yet beyond recognizing the event as expected noise.
          if (event.event_type === 'step.stop') continue

          // status and usage_metadata are checked independently, never one
          // inside an early return for the other's event_type — confirmed
          // live that interaction.status_update carries a bare top-level
          // `status`, and whether a single event ever carries both fields at
          // once is exactly the kind of assumption this parser stopped
          // making after the last two live surprises (D21D.1).
          let recognized = event.event_type === 'interaction.created'
          const status = event.status ?? event.interaction?.status

          if (status !== undefined) {
            recognized = true
            if (status === 'incomplete') stopped = 'context-exhausted'
            else if (status === 'budget_exceeded') {
              // Distinct from context-exhausted (D21D.1) — but whatever it
              // means, throwing away a reply that already arrived would be
              // its own silent-breakage bug. Only refuses the turn below if
              // nothing usable came back at all.
              console.error(
                '[gemini] budget_exceeded status seen — treating as upstream error, not context exhaustion'
              )
              sawBudgetExceeded = true
            }
          }

          const usage = event.interaction?.usage
          if (usage !== undefined) {
            recognized = true
            promptTokens = usage.total_input_tokens
            evalTokens = usage.total_output_tokens
          }

          if (!recognized) {
            // Same diagnostic purpose: an event_type this parser has no
            // branch for at all — the live shape keeps revealing pieces this
            // parser did not know about yet (D21D.1).
            console.error(
              `[gemini] unrecognized event_type: ${event.event_type}, payload: ${payload}`
            )
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    if (steps.size === 0) {
      if (sawBudgetExceeded) {
        throw new UpstreamError(
          null,
          'A Interactions API sinalizou budget_exceeded antes de qualquer resposta utilizável chegar.'
        )
      }
      console.error('[gemini] unexpected Interactions API shape: no steps in response')
      throw new UpstreamError(
        null,
        'Formato de resposta inesperado — o contrato da Interactions API pode ter mudado.'
      )
    }

    let content = ''
    let reasoning = ''
    let reasoningSignature = ''
    let sawModelOutput = false
    for (const step of steps.values()) {
      if (!step.known) continue
      if (step.type === 'thought') {
        // The text is shown regardless of signature — an absent one has no
        // consumer to protect (D21D.3.7). The last non-empty signature seen
        // wins if a turn ever produces more than one thought step (D21D.8).
        if (step.signature === '') {
          console.error('[gemini] thought step closed without a signature')
        } else {
          reasoningSignature = step.signature
        }
        reasoning += step.reasoningText
      } else if (step.type === 'model_output') {
        sawModelOutput = true
        content += step.contentText
      }
    }

    if (sawBudgetExceeded && content === '') {
      throw new UpstreamError(
        null,
        'A Interactions API sinalizou budget_exceeded antes de qualquer resposta utilizável chegar.'
      )
    }

    if (!sawModelOutput || content === '') {
      console.error(
        `[gemini] unexpected Interactions API shape: ${sawModelOutput ? 'model_output step produced no text' : 'no model_output step in a completed turn'}`
      )
      throw new UpstreamError(
        null,
        'Formato de resposta inesperado — o contrato da Interactions API pode ter mudado.'
      )
    }

    if (promptTokens === undefined) {
      console.error('[gemini] no usage seen in this turn — token counters unavailable')
    }

    return {
      content,
      ...(reasoning === '' ? {} : { reasoning }),
      ...(reasoningSignature === '' ? {} : { reasoningSignature }),
      ...(promptTokens === undefined ? {} : { promptTokens }),
      ...(evalTokens === undefined ? {} : { evalTokens }),
      ...(stopped === undefined ? {} : { stopped })
    }
  }
}

/** Nothing resident to report for a cloud provider (core/ai/types.ts). */
export const geminiLoaded: LoadedFn = async () => []
export const geminiUnload: UnloadFn = async () => {}

/** The pinned catalog (Peça C) — no `/api/show` equivalent, so no network at all. */
export const geminiModels: ModelsFn = async () => GEMINI_MODELS
