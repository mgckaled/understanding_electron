import type { AiModel } from '@shared/ipc'
import type { ChatFn, LoadedFn, ModelsFn, ProbeFn, UnloadFn } from '@core/ai/types'
import { UpstreamError } from '@core/ai/types'
import {
  normalizeOllamaModel,
  normalizeOllamaRunning,
  type OllamaRunning,
  type OllamaShow,
  type OllamaTag
} from '@core/ai/models'

// 127.0.0.1, not localhost: skips the DNS lookup and dodges the IPv6/IPv4
// resolution race that makes `localhost` intermittently slow on Windows.
const OLLAMA_HOST = 'http://127.0.0.1:11434'

/** For display only (the footer's popover) — never re-parsed back into a URL. */
export const ollamaDisplayHost = OLLAMA_HOST.replace(/^https?:\/\//, '')

// One line of the /api/chat stream. The chat endpoint carries text under
// message.content (unlike /api/generate, which uses `response`); an error mid
// stream arrives as { error } while the HTTP status stays 200.
type OllamaChatLine = {
  message?: { role: string; content: string }
  done?: boolean
  error?: string
  // Only on the final line — the exact token count the model actually read. See
  // ChatReply.promptTokens for why it is the only exact count and the truncation signal.
  prompt_eval_count?: number
  eval_count?: number
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
 * The catalog: /api/tags once, then /api/show per model (D15.1). The N+1 is
 * deliberate — /api/tags reports neither `vision` nor a context ceiling, so a
 * selector built on it alone mislabels every model (~4,9 s for 14, loads
 * nothing). Sequential, not Promise.all: this hits the local server also running
 * inference, and firing fourteen parallel requests would contend with the answer
 * the user is waiting for. The renderer pays it once and caches.
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

/** What is resident right now. Metadata only — it loads nothing. */
export const ollamaLoaded: LoadedFn = async ({ signal }) => {
  const body = await requestJson<{ models?: OllamaRunning[] }>('/api/ps', { signal })
  return (body.models ?? []).map(normalizeOllamaRunning)
}

/**
 * Drops one model's weights now, instead of waiting out `keep_alive`.
 * `/api/generate` with no prompt and `keep_alive: 0` is the documented unload:
 * answers `done_reason: 'unload'`, never runs inference, costs nothing.
 */
export const ollamaUnload: UnloadFn = async (model, { signal }) => {
  await requestJson('/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, keep_alive: 0 }),
    signal
  })
}

// Built separately so an absent value means ABSENT, never zero: an options
// object carrying num_thread: 0 or num_ctx: 0 would push those defaults onto
// the runner instead of leaving the decision to it.
function chatOptions(numThread?: number, numCtx?: number): Record<string, number> | undefined {
  const options: Record<string, number> = {}
  if (numThread !== undefined) options.num_thread = numThread
  if (numCtx !== undefined) options.num_ctx = numCtx
  return Object.keys(options).length === 0 ? undefined : options
}

export const ollamaChat: ChatFn = async (
  messages,
  { model, numThread, numCtx, signal, onChunk }
) => {
  const options = chatOptions(numThread, numCtx)
  const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      ...(options === undefined ? {} : { options })
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
        // The final line carries the counters — the only exact token count the
        // app can have, so they must not be dropped.
        if (parsed.done === true) {
          return {
            content: assembled,
            ...(parsed.prompt_eval_count === undefined
              ? {}
              : { promptTokens: parsed.prompt_eval_count }),
            ...(parsed.eval_count === undefined ? {} : { evalTokens: parsed.eval_count })
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  // The stream ended without a `done` line — a truncated response rather than a
  // finished one. What arrived is still worth keeping; there are simply no
  // counters to report, which is the same shape a cloud provider may produce.
  return { content: assembled }
}
