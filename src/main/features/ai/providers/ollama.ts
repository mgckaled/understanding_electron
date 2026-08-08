import type { ChatFn, ProbeFn } from '@core/ai/types'
import { UpstreamError } from '@core/ai/types'

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
