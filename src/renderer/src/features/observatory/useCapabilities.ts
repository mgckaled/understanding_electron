import { useQuery } from '@tanstack/react-query'
import { dropRedundantVariants, findEmbedders, hasCapability } from '@core/ai/models'
import { CLOUD_PROVIDERS } from '@shared/ipc'
import type {
  AiAvailability,
  AiModel,
  AiService,
  AppError,
  CloudProvider,
  LoadedModel
} from '@shared/ipc'
import type { ViewState } from '../../shared/ui/state'

export const AI_SERVICES: AiService[] = ['ollama', 'glm', 'gemini']

export type ServiceCapability = {
  availability: ViewState<AiAvailability>
  models: ViewState<AiModel[]>
}

export type CapabilitiesData = {
  services: Record<AiService, ServiceCapability>
  cloudKeys: Record<CloudProvider, boolean>
  loadedModels: ViewState<LoadedModel[]>
  /**
   * Every embedder across every service, deduped, pulled out of `services`
   * (DO4.5, corrected 01/09/2026): one line per model, never two — the
   * catalog is the same read whether the provider is local or cloud opt-in.
   */
  embedders: AiModel[]
}

/** `models` with every `embedding` model removed — it belongs in `embedders` instead. */
function withoutEmbedders(models: AiModel[]): ViewState<AiModel[]> {
  const remaining = models.filter((model) => !hasCapability(model, 'embedding'))
  return remaining.length === 0 ? { status: 'empty' } : { status: 'ready', data: remaining }
}

function settledResultState<T>(
  outcome: PromiseSettledResult<{ ok: true; value: T } | { ok: false; error: AppError }>,
  channel: string
): ViewState<T> {
  if (outcome.status === 'rejected') {
    return { status: 'error', error: { kind: 'unknown', message: channel } }
  }
  if (!outcome.value.ok) return { status: 'error', error: outcome.value.error }
  const { value } = outcome.value
  if (Array.isArray(value) && value.length === 0) return { status: 'empty' }
  return { status: 'ready', data: value }
}

async function fetchCapabilities(): Promise<CapabilitiesData> {
  const [availabilities, models, cloudHas, loaded] = await Promise.all([
    Promise.allSettled(AI_SERVICES.map((service) => window.api.ai.isAvailable(service))),
    Promise.allSettled(AI_SERVICES.map((service) => window.api.ai.models(service))),
    Promise.allSettled(CLOUD_PROVIDERS.map((provider) => window.api.secrets.has(provider))),
    Promise.allSettled([window.api.ai.loaded('ollama')])
  ])

  const services = {} as Record<AiService, ServiceCapability>
  const embedders: AiModel[] = []
  AI_SERVICES.forEach((service, index) => {
    const modelsState = settledResultState(models[index]!, 'ai:models')
    // A Modelfile clone made for mill.tools (sibling app, same Ollama) is not a
    // second installed model — dropped before the embedder split below, so it
    // never reaches either table.
    const deduped = modelsState.status === 'ready' ? dropRedundantVariants(modelsState.data) : null
    if (deduped !== null) embedders.push(...findEmbedders(deduped))

    services[service] = {
      availability: settledResultState(availabilities[index]!, 'ai:isAvailable'),
      models: deduped !== null ? withoutEmbedders(deduped) : modelsState
    }
  })

  const cloudKeys = {} as Record<CloudProvider, boolean>
  CLOUD_PROVIDERS.forEach((provider, index) => {
    const outcome = cloudHas[index]!
    cloudKeys[provider] = outcome.status === 'fulfilled' && outcome.value
  })

  return {
    services,
    cloudKeys,
    loadedModels: settledResultState(loaded[0]!, 'ai:loaded'),
    embedders
  }
}

/**
 * The trilha O's first `Caro` sondagem (§ 4.3, DO4.2/DO4.3): one query, nine
 * calls settled independently — a service down never hides the other two,
 * and the whole thing only runs when `refetch` is called.
 */
export function useCapabilities(): {
  data: CapabilitiesData | undefined
  isFetching: boolean
  dataUpdatedAt: number
  refetch: () => void
} {
  const { data, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['observatory', 'capabilities'],
    queryFn: fetchCapabilities,
    enabled: false
  })

  return { data, isFetching, dataUpdatedAt, refetch: () => void refetch() }
}
