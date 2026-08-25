import type {
  AiService,
  ColumnProfile,
  DatasetPart,
  JobId,
  Result,
  StepProposal
} from '@shared/ipc'
import type { ChatFn } from '@core/ai/types'
import { requestStepProposal } from '@core/ai/proposal'
import { err } from '@core/result'
import * as jobs from '../../jobs'
import { mapProviderError } from './handlers'

// Same budget as chat (D9.3/D9.2 note in handlers.ts) — cold model load
// dominates either call, and a proposal is one model call, not a shorter one.
const PROPOSE_TIMEOUT_MS = 1_000_000

type ProposeArgs = {
  service: AiService
  model: string
  hash: string
  card: DatasetPart
  request: string
  numThread?: number
  numCtx?: number
  jobId: JobId
}

/**
 * Turns a Portuguese request over an attached dataset into a StepProposal
 * (D9.4/D19.5) — its own model call and its own job, cancellable like chat.
 * `runProfile` is refetched here rather than trusted from the renderer
 * (same reasoning as `transformDataset`'s `runSchema`), and its own failure
 * maps to `invalidQuery` — the dataset/engine error family — distinct from
 * a chat-fn failure, which maps through `mapProviderError` like `chat` does.
 */
export async function propose(
  { service, model, hash, card, request, numThread, numCtx, jobId }: ProposeArgs,
  chatFn: ChatFn,
  runProfile: (hash: string) => Promise<ColumnProfile[]>
): Promise<Result<StepProposal>> {
  const controller = jobs.create(jobId)
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, PROPOSE_TIMEOUT_MS)

  try {
    let profile: ColumnProfile[]
    try {
      profile = await runProfile(hash)
    } catch (error) {
      return err({ kind: 'invalidQuery', message: (error as Error).message })
    }

    return await requestStepProposal(
      chatFn,
      { card, profile, request, model, numThread, numCtx },
      { signal: controller.signal }
    )
  } catch (error) {
    if (timedOut) return err({ kind: 'timeout', afterMs: PROPOSE_TIMEOUT_MS })
    if (controller.signal.aborted) return err({ kind: 'cancelled' })
    return err(mapProviderError(error, service))
  } finally {
    clearTimeout(timeout)
    jobs.finish(jobId)
  }
}
