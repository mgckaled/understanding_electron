import type { ChatMessage } from '@shared/ipc'
import type { ChatFn, LoadedFn, ModelsFn, ProbeFn, UnloadFn } from '@core/ai/types'
import { UpstreamError } from '@core/ai/types'
import { GEMINI_MODELS } from '@core/ai/models'
import { describeUpstreamError } from '@core/ai/upstreamError'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

// Legacy streamGenerateContent + ?alt=sse (Context7, N-1-C) — NOT the newer
// "Interactions" API, which wants server-side previous_interaction_id and
// would break the stateless full-history-resend model this app uses for
// every provider. ?alt=sse is what turns the response into real "data:
// {...}" lines instead of a plain chunked JSON array.
function streamUrl(model: string): string {
  return `${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse`
}

// One line of the Gemini SSE stream. Same candidate shape whether streamed
// or not — confirmed via Context7 against the official REST reference.
type GeminiChunk = {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
}

// Gemini uses role 'model', not 'assistant', and has no 'system' role inside
// `contents` — a system message goes in the separate `systemInstruction`
// field. The two real differences from GLM's OpenAI-compatible shape.
function toGeminiContents(messages: ChatMessage[]): unknown[] {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }]
    }))
}

function systemInstructionOf(messages: ChatMessage[]): unknown | undefined {
  const system = messages.find((message) => message.role === 'system')
  return system === undefined ? undefined : { parts: [{ text: system.content }] }
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

export function makeGeminiChat(getApiKey: () => string | null): ChatFn {
  return async (messages, { model, signal, onChunk }) => {
    const apiKey = getApiKey()
    if (apiKey === null) throw new UpstreamError(null, 'no api key stored')

    const systemInstruction = systemInstructionOf(messages)
    const response = await fetch(streamUrl(model), {
      method: 'POST',
      // x-goog-api-key, not Authorization: Bearer — confirmed via Context7
      // against the official docs, unlike GLM's OpenAI-compatible header.
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: toGeminiContents(messages),
        ...(systemInstruction === undefined ? {} : { systemInstruction }),
        // thinkingLevel replaces thinkingBudget for the 3.x generation
        // (Context7) — but the valid ENUM differs by model: gemini-3.1-flash-lite
        // accepts 'minimal', gemini-3.7-flash does not (measured live, N-1-C —
        // "Thinking level MINIMAL is not supported for this model", HTTP 400).
        // 'low' is the lowest level confirmed valid for both, so it is the
        // universal choice here — not a true off switch (there is none in this
        // family), same stopgap as glm.ts/ollama.ts's qwen3:4b, adiado para os
        // planos 21-23.
        generationConfig: { thinkingConfig: { thinkingLevel: 'low' } }
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
    let assembled = ''
    let buffer = ''
    let promptTokens: number | undefined
    let evalTokens: number | undefined

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
          const chunk = JSON.parse(payload) as GeminiChunk
          const piece =
            chunk.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
          if (piece !== '') {
            assembled += piece
            onChunk?.(piece)
          }
          if (chunk.usageMetadata !== undefined) {
            promptTokens = chunk.usageMetadata.promptTokenCount
            evalTokens = chunk.usageMetadata.candidatesTokenCount
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return {
      content: assembled,
      ...(promptTokens === undefined ? {} : { promptTokens }),
      ...(evalTokens === undefined ? {} : { evalTokens })
    }
  }
}

/** Nothing resident to report for a cloud provider (core/ai/types.ts). */
export const geminiLoaded: LoadedFn = async () => []
export const geminiUnload: UnloadFn = async () => {}

/** The pinned catalog (Peça C) — no `/api/show` equivalent, so no network at all. */
export const geminiModels: ModelsFn = async () => GEMINI_MODELS
