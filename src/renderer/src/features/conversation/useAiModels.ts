import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AiModel, AiService } from '@shared/ipc'
import type { ViewState } from '../../shared/ui/state'
import { selectableModels } from './conversations'

/**
 * The installed models, a server cache with manual reload (D15.1). The catalog
 * costs N+1 (~4,9 s for 14), too expensive to refetch on every dropdown open,
 * cheap enough to redo on demand — so `staleTime: Infinity` plus a button,
 * because INSTALLING A MODEL IS A SYSTEM EVENT the app cannot observe. `empty`
 * is distinct from `error`: a fresh Ollama deserves "install a model", not a
 * red card.
 *
 * @param service - Which provider's catalog (N-1-B) — the query key includes
 *   it, so switching service never shows the other one's cached list.
 */
export function useAiModels(service: AiService): {
  state: ViewState<AiModel[]>
  reload: () => void
} {
  const queryClient = useQueryClient()
  const modelsKey = useMemo(() => ['ai', 'models', service] as const, [service])

  const { data, isPending, isError } = useQuery({
    queryKey: modelsKey,
    queryFn: () => window.api.ai.models(service)
  })

  const reload = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: modelsKey })
  }, [queryClient, modelsKey])

  const state = useMemo((): ViewState<AiModel[]> => {
    if (isPending) return { status: 'loading' }
    // A rejected query means the IPC itself failed, which is a defect rather
    // than a provider being down — that arrives as a resolved Result below.
    if (isError || data === undefined) {
      return { status: 'error', error: { kind: 'unknown', message: 'ai:models' } }
    }
    if (!data.ok) return { status: 'error', error: data.error }
    // Filtered HERE and nowhere else (D15.11): filtering at one consumer left
    // the <select> reading the raw list while resolution read the filtered one,
    // so hidden entries stayed on screen and every level-1 test still passed.
    const usable = selectableModels(data.value)
    return usable.length === 0 ? { status: 'empty' } : { status: 'ready', data: usable }
  }, [data, isPending, isError])

  return useMemo(() => ({ state, reload }), [state, reload])
}
