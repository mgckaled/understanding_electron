import type { ChatMessage } from '@shared/ipc'

// The single network-touching seam, injected by the caller (D9.2). core/ never
// knows which provider fulfills it — the concrete adapters live in
// main/features/ai/providers/. Same shape as mill.tools' make_llm_fn, and the
// reason the level-1 test runs with no Ollama installed.
export type ChatFn = (
  messages: ChatMessage[],
  opts: {
    model: string
    numThread?: number
    signal?: AbortSignal
    onChunk?: (text: string) => void
  }
) => Promise<string>

// Availability probe seam for the gate (D9.3). Resolves to the service version
// on success, or throws — the handler turns the throw into AppError.unavailable.
export type ProbeFn = (opts: { signal?: AbortSignal }) => Promise<string>

// Thrown by an adapter when the provider answered but with an error: a non-2xx
// HTTP status (status set) or an error object inside an otherwise-200 stream
// (status null). Lets the main handler map to AppError.upstream without
// importing any provider-specific type — keeps the handler provider-agnostic.
export class UpstreamError extends Error {
  constructor(
    readonly status: number | null,
    message: string
  ) {
    super(message)
    this.name = 'UpstreamError'
  }
}
