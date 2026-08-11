import type {
  AiAvailability,
  AiModel,
  AiService,
  AppError,
  ChatMessage,
  ChatReply,
  JobEvent,
  JobId,
  LoadedModel,
  Result
} from '@shared/ipc'
import type { ChatFn, LoadedFn, ModelsFn, ProbeFn, UnloadFn } from '@core/ai/types'
import { UpstreamError } from '@core/ai/types'
import { runChat } from '@core/ai/chat'
import { ok, err } from '@core/result'
import * as jobs from '../../jobs'

// Short deadline for the availability ping, long one for the real call (D9.3):
// without the split, the status card hangs for minutes when Ollama is down.
const PING_TIMEOUT_MS = 10_000
const CHAT_TIMEOUT_MS = 300_000
// Between the two: the catalog is N+1 requests (4,9 s for 14 models, measured)
// and grows with the fleet, but it never runs inference, so minutes would only
// mean the service is wedged.
const CATALOG_TIMEOUT_MS = 60_000

const HINTS: Record<AiService, string> = {
  ollama: 'Verifique se o Ollama está em execução (ollama serve) na porta 11434.'
}

export async function isAvailable(
  { service }: { service: AiService },
  probe: ProbeFn
): Promise<Result<AiAvailability>> {
  try {
    const version = await probe({ signal: AbortSignal.timeout(PING_TIMEOUT_MS) })
    return ok({ service, version })
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
 *
 * Weights stay resident for five minutes after the last request by default, and
 * on this machine that is long enough to make the rest of the fleet read as
 * "não cabe" while nothing is running. Manual and never automatic: unloading on
 * conversation switch would evict a model because the user LOOKED at another
 * conversation, and pay ~50 s to bring it back — the provider only loads on a
 * request, so switching costs nothing until something is sent.
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
  messages: ChatMessage[]
  numThread?: number
  numCtx?: number
  jobId: JobId
}

export async function chat(
  { service, model, messages, numThread, numCtx, jobId }: ChatArgs,
  chatFn: ChatFn,
  emit: (event: JobEvent) => void
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
    return await runChat(
      chatFn,
      { messages, model, numThread, numCtx },
      { signal: controller.signal, onChunk }
    )
  } catch (error) {
    if (timedOut) return err({ kind: 'timeout', afterMs: CHAT_TIMEOUT_MS })
    if (controller.signal.aborted) return err({ kind: 'cancelled' })
    return err(mapProviderError(error, service))
  } finally {
    clearTimeout(timeout)
    jobs.finish(jobId)
  }
}

// Shared by chat and the catalog: both talk to the same provider over the same
// transport, so both fail in the same two ways.
function mapProviderError(error: unknown, service: AiService): AppError {
  if (error instanceof UpstreamError) {
    return { kind: 'upstream', service, status: error.status, message: error.message }
  }
  // fetch rejects with a TypeError (cause ECONNREFUSED, DNS, ...) when the
  // service can't be reached at all — the same meaning as a failed probe.
  return { kind: 'unavailable', service, hint: HINTS[service] }
}
