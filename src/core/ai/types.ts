import type { AiModel, ChatMessage, ChatReply, LoadedModel } from '@shared/ipc'

// The single network-touching seam, injected by the caller (D9.2). core/ never
// knows which provider fulfills it — the concrete adapters live in
// main/features/ai/providers/. Same shape as mill.tools' make_llm_fn, and the
// reason the level-1 test runs with no Ollama installed.
export type ChatFn = (
  messages: ChatMessage[],
  opts: {
    model: string
    numThread?: number
    numCtx?: number
    signal?: AbortSignal
    onChunk?: (text: string) => void
  }
  // Resolves to ChatReply, not a bare string: the stream's final line carries
  // the token counters, the only exact count that exists (nothing tokenizes
  // before sending), which the meter needs to calibrate (D15.4).
) => Promise<ChatReply>

// Availability probe seam for the gate (D9.3). Resolves to the service version
// on success, or throws — the handler turns the throw into AppError.unavailable.
export type ProbeFn = (opts: { signal?: AbortSignal }) => Promise<string>

// Catalog seam (D15.1), same shape and same contract as ProbeFn: resolves to
// the normalized list, or throws for the handler to classify. Cloud providers
// will fulfil it from a table instead of a probe — which is precisely why the
// seam is a function returning AiModel[] and not an HTTP-shaped thing.
export type ModelsFn = (opts: { signal?: AbortSignal }) => Promise<AiModel[]>

// What the provider is holding in memory, and letting go of it. Both throw for
// the handler to classify, like every seam above. A cloud provider fulfils the
// first with an empty list and the second with a no-op — there is nothing
// resident to report, which is a true answer and not a missing feature.
export type LoadedFn = (opts: { signal?: AbortSignal }) => Promise<LoadedModel[]>
export type UnloadFn = (model: string, opts: { signal?: AbortSignal }) => Promise<void>

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
