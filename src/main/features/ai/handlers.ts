import type {
  AiAvailability,
  AiService,
  AppError,
  ChatMessage,
  ChatReply,
  JobEvent,
  JobId,
  Result
} from '@shared/ipc'
import type { ChatFn, ProbeFn } from '@core/ai/types'
import { UpstreamError } from '@core/ai/types'
import { runChat } from '@core/ai/chat'
import { ok, err } from '@core/result'
import * as jobs from '../../jobs'

// Short deadline for the availability ping, long one for the real call (D9.3):
// without the split, the status card hangs for minutes when Ollama is down.
const PING_TIMEOUT_MS = 10_000
const CHAT_TIMEOUT_MS = 300_000

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

type ChatArgs = {
  service: AiService
  model: string
  messages: ChatMessage[]
  numThread?: number
  jobId: JobId
}

export async function chat(
  { service, model, messages, numThread, jobId }: ChatArgs,
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
      { messages, model, numThread },
      { signal: controller.signal, onChunk }
    )
  } catch (error) {
    if (timedOut) return err({ kind: 'timeout', afterMs: CHAT_TIMEOUT_MS })
    if (controller.signal.aborted) return err({ kind: 'cancelled' })
    return err(mapChatError(error, service))
  } finally {
    clearTimeout(timeout)
    jobs.finish(jobId)
  }
}

function mapChatError(error: unknown, service: AiService): AppError {
  if (error instanceof UpstreamError) {
    return { kind: 'upstream', service, status: error.status, message: error.message }
  }
  // fetch rejects with a TypeError (cause ECONNREFUSED, DNS, ...) when the
  // service can't be reached at all — the same meaning as a failed probe.
  return { kind: 'unavailable', service, hint: HINTS[service] }
}
