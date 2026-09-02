import type {
  AiAvailability,
  AiModel,
  AiService,
  AppError,
  ChatReply,
  JobEvent,
  JobId,
  LoadedModel,
  Message,
  Result
} from '@shared/ipc'
import type { ChatFn, LoadedFn, ModelsFn, ProbeFn, UnloadFn } from '@core/ai/types'
import { UpstreamError } from '@core/ai/types'
import { isCloudService, toChatMessagesWithImages } from '@core/ai/messages'
import { ok, err } from '@core/result'
import type { PerformanceEvent } from '@core/observatory/performance'
import { countAttachments, type PrivacyEvent } from '@core/observatory/privacy'
import { measureChatTiming } from '../../observatory/chatTiming'
import * as jobs from '../../jobs'

// Short deadline for the availability ping, long one for the real call (D9.3):
// without the split, the status card hangs for minutes when Ollama is down.
const PING_TIMEOUT_MS = 10_000
// Measured 2026-08-19: gemma3:4b cold-loads in ~48 s and prefills at ~23
// tok/s on this CPU — a 14 KB document alone used 240 s of the old 300 s
// budget. Raised flat; excluding load from the clock was the alternative.
const CHAT_TIMEOUT_MS = 1_000_000
// Between the two: the catalog is N+1 requests (4,9 s for 14 models, measured)
// and grows with the fleet, but it never runs inference, so minutes would only
// mean the service is wedged.
const CATALOG_TIMEOUT_MS = 60_000

const HINTS: Record<AiService, string> = {
  ollama: 'Verifique se o Ollama está em execução (ollama serve) na porta 11434.',
  glm: 'Configure a chave da Z.ai em Configurações para usar o GLM.',
  gemini: 'Configure a chave do Google AI Studio em Configurações para usar o Gemini.'
}

/**
 * Whether the service answers, carrying its version and (for a local provider)
 * where it lives.
 *
 * @param host - Display host:port, kept out of `ProbeFn` itself: a future cloud
 *   provider fulfils that seam with no endpoint to report.
 */
export async function isAvailable(
  { service }: { service: AiService },
  probe: ProbeFn,
  host?: string
): Promise<Result<AiAvailability>> {
  try {
    const version = await probe({ signal: AbortSignal.timeout(PING_TIMEOUT_MS) })
    return ok({ service, version, host })
  } catch {
    // Service down and a missing key look identical to the UI (D9.3): one card,
    // disabled, carrying the hint — no path breaks.
    return err({ kind: 'unavailable', service, hint: HINTS[service] })
  }
}

/**
 * The catalog (D15.1). Result, not a throw: Ollama being down leaves the
 * selector empty with a hint, which is a state the UI draws — the same shape as
 * the availability gate, and not a programming defect.
 */
export async function models(
  { service }: { service: AiService },
  modelsFn: ModelsFn
): Promise<Result<AiModel[]>> {
  try {
    return ok(await modelsFn({ signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS) }))
  } catch (error) {
    return err(mapProviderError(error, service))
  }
}

/**
 * What the provider holds in memory, and dropping it (antecipado do plano 17).
 * Manual, never automatic: the provider only loads on a request, so switching
 * conversation costs nothing until a send, and evicting on switch would pay
 * ~50 s to reload a model the user merely LOOKED away from.
 */
export async function loaded(
  { service }: { service: AiService },
  loadedFn: LoadedFn
): Promise<Result<LoadedModel[]>> {
  try {
    return ok(await loadedFn({ signal: AbortSignal.timeout(PING_TIMEOUT_MS) }))
  } catch (error) {
    return err(mapProviderError(error, service))
  }
}

export async function unload(
  { service, model }: { service: AiService; model: string },
  unloadFn: UnloadFn
): Promise<Result<void>> {
  try {
    await unloadFn(model, { signal: AbortSignal.timeout(PING_TIMEOUT_MS) })
    return ok(undefined)
  } catch (error) {
    return err(mapProviderError(error, service))
  }
}

type ChatArgs = {
  service: AiService
  model: string
  messages: Message[]
  numThread?: number
  numCtx?: number
  wantsReasoning?: boolean
  jobId: JobId
}

export async function chat(
  { service, model, messages, numThread, numCtx, wantsReasoning, jobId }: ChatArgs,
  chatFn: ChatFn,
  emit: (event: JobEvent) => void,
  resolveImageBytes: (hash: string) => Promise<Buffer>,
  recordPerformance?: (event: PerformanceEvent) => void,
  recordPrivacy?: (event: PrivacyEvent) => void
): Promise<Result<ChatReply>> {
  const controller = jobs.create(jobId)
  // Two abort sources feed one controller; `timedOut` tells them apart in the
  // catch — the user's cancel and the deadline must map to different AppErrors.
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, CHAT_TIMEOUT_MS)

  try {
    const onChunk = (text: string): void => emit({ jobId, type: 'chunk', text })
    // D21A.1: presence, not the boolean itself, is what an adapter reads —
    // this is the one place wantsReasoning turns into that presence.
    const onThinking =
      wantsReasoning === true
        ? (text: string): void => emit({ jobId, type: 'reasoning', text })
        : undefined
    // The renderer sends what it models the conversation as; materializing
    // into the provider's flat shape happens here, not there (D17.5) — a
    // message with an image part needs bytes the sandboxed renderer cannot
    // read from userData/attachments.
    const chatMessages = await toChatMessagesWithImages(messages, resolveImageBytes)
    // After materialization, right before the provider call (DO8.3 revised):
    // a resolveImageBytes failure above never reaches here, so this never
    // records a send that did not happen.
    if (isCloudService(service)) {
      recordPrivacy?.({ service, model, ...countAttachments(messages) })
    }
    const { result, timing } = await measureChatTiming(
      chatFn,
      { messages: chatMessages, model, numThread, numCtx },
      { signal: controller.signal, onChunk, onThinking }
    )
    if (timing !== null) recordPerformance?.({ service, model, ...timing })
    return result
  } catch (error) {
    if (timedOut) return err({ kind: 'timeout', afterMs: CHAT_TIMEOUT_MS })
    if (controller.signal.aborted) return err({ kind: 'cancelled' })
    return err(mapProviderError(error, service))
  } finally {
    clearTimeout(timeout)
    jobs.finish(jobId)
  }
}

// Shared by chat, propose and the catalog: all talk to the same provider
// over the same transport, so all fail in the same two ways.
export function mapProviderError(error: unknown, service: AiService): AppError {
  if (error instanceof UpstreamError) {
    return { kind: 'upstream', service, status: error.status, message: error.message }
  }
  // fetch rejects with a TypeError (cause ECONNREFUSED, DNS, ...) when the
  // service can't be reached at all — the same meaning as a failed probe.
  return { kind: 'unavailable', service, hint: HINTS[service] }
}
