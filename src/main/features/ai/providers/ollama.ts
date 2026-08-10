import type { AiModel } from '@shared/ipc'
import type { ChatFn, ModelsFn, ProbeFn } from '@core/ai/types'
import { UpstreamError } from '@core/ai/types'
import { normalizeOllamaModel, type OllamaShow, type OllamaTag } from '@core/ai/models'

// 127.0.0.1, not localhost: skips the DNS lookup and dodges the IPv6/IPv4
// resolution race that makes `localhost` intermittently slow on Windows.
const OLLAMA_HOST = 'http://127.0.0.1:11434'

// One line of the /api/chat stream. The chat endpoint carries text under
// message.content (unlike /api/generate, which uses `response`); an error mid
// stream arrives as { error } while the HTTP status stays 200.
type OllamaChatLine = {
  message?: { role: string; content: string }
  done?: boolean
  error?: string
}

// Cheapest availability ping: /api/version returns only { version }, without
// enumerating models or touching disk (D9.3 — short timeout for the probe).
export const ollamaProbe: ProbeFn = async ({ signal }) => {
  const response = await fetch(`${OLLAMA_HOST}/api/version`, { signal })
  if (!response.ok) throw new UpstreamError(response.status, `HTTP ${response.status}`)
  const body = (await response.json()) as { version?: string }
  return body.version ?? 'unknown'
}

// Both catalog endpoints answer with one JSON body — no streaming, unlike
// /api/chat — so they share this. Non-2xx becomes UpstreamError for the handler
// to classify, exactly as ollamaProbe does.
async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${OLLAMA_HOST}${path}`, init)
  if (!response.ok) throw new UpstreamError(response.status, `HTTP ${response.status}`)
  return (await response.json()) as T
}

/**
 * The catalog: /api/tags once, then /api/show per model (D15.1).
 *
 * The N+1 is deliberate, because one call does not answer the question.
 * /api/tags reports neither `vision` nor any context ceiling, so a selector
 * built on it alone would mislabel every model. Measured at ~4,9 s for 14
 * models, and it loads nothing — /api/ps stays empty across the whole sweep,
 * so the cost is latency, not RAM.
 *
 * Sequential, not Promise.all: this hits a local server that is also the one
 * running inference. Firing fourteen parallel requests at a process that may be
 * mid-generation would buy a few seconds and contend with the thing the user is
 * actually waiting for. The renderer pays this once and caches it.
 */
export const ollamaModels: ModelsFn = async ({ signal }) => {
  const tags = await requestJson<{ models?: OllamaTag[] }>('/api/tags', { signal })

  const models: AiModel[] = []
  for (const tag of tags.models ?? []) {
    const show = await requestJson<OllamaShow>('/api/show', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: tag.name }),
      signal
    })
    models.push(normalizeOllamaModel(tag, show))
  }
  return models
}

export const ollamaChat: ChatFn = async (messages, { model, numThread, signal, onChunk }) => {
  const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      // Only attach options when we actually cap threads: an empty options
      // object would still push num_thread's zero-default onto the runner.
      ...(numThread !== undefined ? { options: { num_thread: numThread } } : {})
    }),
    signal
  })

  if (!response.ok || response.body === null) {
    throw new UpstreamError(response.status, `HTTP ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let assembled = ''
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // NDJSON: one JSON object per line, but a socket read can split a line
      // across two chunks — carry the tail in `buffer` until its newline lands.
      let newline: number
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (line === '') continue

        const parsed = JSON.parse(line) as OllamaChatLine
        if (parsed.error !== undefined) throw new UpstreamError(null, parsed.error)

        const piece = parsed.message?.content ?? ''
        if (piece !== '') {
          assembled += piece
          onChunk?.(piece)
        }
        if (parsed.done === true) return assembled
      }
    }
  } finally {
    reader.releaseLock()
  }

  return assembled
}
