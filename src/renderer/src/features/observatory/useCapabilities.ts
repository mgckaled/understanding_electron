import { useQuery } from '@tanstack/react-query'
import { dropRedundantVariants } from '@core/ai/models'
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
  AI_SERVICES.forEach((service, index) => {
    const modelsState = settledResultState(models[index]!, 'ai:models')
    services[service] = {
      availability: settledResultState(availabilities[index]!, 'ai:isAvailable'),
      // A Modelfile clone made for mill.tools (sibling app, same Ollama) is not
      // a second installed model — dropped here so it never reaches a table.
      models:
        modelsState.status === 'ready'
          ? { ...modelsState, data: dropRedundantVariants(modelsState.data) }
          : modelsState
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
    loadedModels: settledResultState(loaded[0]!, 'ai:loaded')
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
