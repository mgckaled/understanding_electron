import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AiModel } from '@shared/ipc'
import type { ViewState } from '../../shared/ui/state'
import { selectableModels } from './conversations'

const SERVICE = 'ollama' as const
const MODELS_KEY = ['ai', 'models'] as const

/**
 * The installed models, as a server cache with a manual reload (D15.1).
 *
 * The catalog costs N+1 requests — ~4,9 s for 14 models — which lands it in an
 * unusual place: expensive enough that refetching it every time a dropdown
 * opens would be absurd, cheap enough to redo whenever the user asks. So it
 * inherits the client's `staleTime: Infinity` and gains a button, because
 * INSTALLING A MODEL IS A SYSTEM EVENT the app has no way to observe. The fleet
 * on this machine went from 10 to 14 entries between two sessions and nothing
 * in the app could have noticed.
 *
 * `empty` is distinct from `error` on purpose: a fresh Ollama with nothing
 * pulled is a legitimate state that deserves "install a model", not a red card
 * saying something broke.
 */
export function useAiModels(): { state: ViewState<AiModel[]>; reload: () => void } {
  const queryClient = useQueryClient()

  const { data, isPending, isError } = useQuery({
    queryKey: MODELS_KEY,
    queryFn: () => window.api.ai.models(SERVICE)
  })

  const reload = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: MODELS_KEY })
  }, [queryClient])

  const state = useMemo((): ViewState<AiModel[]> => {
    if (isPending) return { status: 'loading' }
    // A rejected query means the IPC itself failed, which is a defect rather
    // than a provider being down — that arrives as a resolved Result below.
    if (isError || data === undefined) {
      return { status: 'error', error: { kind: 'unknown', message: 'ai:models' } }
    }
    if (!data.ok) return { status: 'error', error: data.error }
    // Filtered HERE and nowhere else (D15.11). Doing it at one consumer left
    // the <select> reading the raw list while the model resolution read the
    // filtered one — the hidden entries stayed on screen and every level-1 test
    // still passed.
    const usable = selectableModels(data.value)
    return usable.length === 0 ? { status: 'empty' } : { status: 'ready', data: usable }
  }, [data, isPending, isError])

  return useMemo(() => ({ state, reload }), [state, reload])
}
