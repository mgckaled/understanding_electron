import type { ChatFn, LoadedFn, ModelsFn, ProbeFn, UnloadFn } from '@core/ai/types'
import { UpstreamError } from '@core/ai/types'
import { GLM_MODELS } from '@core/ai/models'
import { describeUpstreamError } from '@core/ai/upstreamError'

// Confirmed via Context7 (docs.z.ai, N-1-B): OpenAI-compatible chat
// completions, SSE streaming — corroborated by mill.tools running this same
// model in production against this same base_url.
const GLM_ENDPOINT = 'https://api.z.ai/api/paas/v4/chat/completions'

// One line of the GLM SSE stream: "data: {...}" per chunk, terminated by
// "data: [DONE]". The final content-bearing line carries `usage` alongside
// `finish_reason` — not a separate line, unlike Ollama's NDJSON.
type GlmChunk = {
  choices?: { delta?: { content?: string; reasoning_content?: string } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

/**
 * "Available" on the cloud means "there is a key stored" (Peça 9) — never a
 * real ping, which would spend a call just to answer a status card. `hasKey`
 * reuses `hasSecret` (N-1-A): cheap, no decrypt.
 */
export function makeGlmProbe(hasKey: () => boolean): ProbeFn {
  return async () => {
    if (!hasKey()) throw new UpstreamError(null, 'no api key stored')
    return 'glm-4.7-flash' // no version to report, unlike a local service
  }
}

export function makeGlmChat(getApiKey: () => string | null): ChatFn {
  return async (messages, { model, signal, onChunk, onThinking }) => {
    const apiKey = getApiKey()
    if (apiKey === null) throw new UpstreamError(null, 'no api key stored')

    const response = await fetch(GLM_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        // D21A.1: onThinking's presence is the request, not a separate flag.
        thinking: { type: onThinking !== undefined ? 'enabled' : 'disabled' }
      }),
      signal
    })

    if (!response.ok || response.body === null) {
      const body = await response.text().catch(() => '')
      // Raw, untreated — the terminal running `pnpm dev` is the only place
      // the actual GLM error body is visible; the UI only gets the short
      // classification below.
      console.error(`[glm] HTTP ${response.status}`, body)
      throw new UpstreamError(response.status, describeUpstreamError(response.status, body))
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let assembled = ''
    let reasoningAssembled = ''
    let buffer = ''
    let promptTokens: number | undefined
    let evalTokens: number | undefined

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE: one "data: {...}" event per line, but a socket read can split
        // one across two chunks — carry the tail in `buffer` until the
        // newline lands, same discipline as ollama.ts's NDJSON parser.
        let newline: number
        while ((newline = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newline).trim()
          buffer = buffer.slice(newline + 1)
          if (line === '' || !line.startsWith('data: ')) continue

          const payload = line.slice('data: '.length)
          if (payload === '[DONE]') {
            return {
              content: assembled,
              ...(reasoningAssembled === '' ? {} : { reasoning: reasoningAssembled }),
              ...(promptTokens === undefined ? {} : { promptTokens }),
              ...(evalTokens === undefined ? {} : { evalTokens })
            }
          }

          const chunk = JSON.parse(payload) as GlmChunk
          const thinkingPiece = chunk.choices?.[0]?.delta?.reasoning_content ?? ''
          if (thinkingPiece !== '') {
            reasoningAssembled += thinkingPiece
            onThinking?.(thinkingPiece)
          }
          const piece = chunk.choices?.[0]?.delta?.content ?? ''
          if (piece !== '') {
            assembled += piece
            onChunk?.(piece)
          }
          if (chunk.usage !== undefined) {
            promptTokens = chunk.usage.prompt_tokens
            evalTokens = chunk.usage.completion_tokens
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    // The stream ended without a [DONE] line — truncated, not finished. What
    // arrived is still worth keeping, same fallback as ollama.ts.
    return {
      content: assembled,
      ...(reasoningAssembled === '' ? {} : { reasoning: reasoningAssembled }),
      ...(promptTokens === undefined ? {} : { promptTokens }),
      ...(evalTokens === undefined ? {} : { evalTokens })
    }
  }
}

/** Nothing resident to report for a cloud provider — a true answer, not a missing feature (core/ai/types.ts). */
export const glmLoaded: LoadedFn = async () => []
export const glmUnload: UnloadFn = async () => {}

/** The pinned catalog (Peça C) — no `/api/show` equivalent, so no network at all. */
export const glmModels: ModelsFn = async () => GLM_MODELS
