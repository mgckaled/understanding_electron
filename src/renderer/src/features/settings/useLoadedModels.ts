import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LoadedModel } from '@shared/ipc'
import type { ViewState } from '../../shared/ui/state'

const SERVICE = 'ollama' as const
const LOADED_KEY = ['ai', 'loaded'] as const

/**
 * What the provider is holding in memory, and letting go of it. Unlike the
 * catalog, `staleTime: 0` and refetches on mount: the figure changes on its own
 * (the provider drops a model five minutes after the last request), so a cached
 * answer would be stale by construction.
 */
export function useLoadedModels(): {
  state: ViewState<LoadedModel[]>
  unload: (model: string) => void
  unloading: boolean
} {
  const queryClient = useQueryClient()

  const { data, isPending, isError } = useQuery({
    queryKey: LOADED_KEY,
    queryFn: () => window.api.ai.loaded(SERVICE),
    staleTime: 0
  })

  const mutation = useMutation({
    mutationFn: (model: string) => window.api.ai.unload(SERVICE, model),
    // Both, and the second is the point of the button: freeing the weights is
    // what changes every model's context ceiling, and the memory reading is
    // held with an infinite staleTime precisely so it does not move on its own.
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LOADED_KEY })
      await queryClient.invalidateQueries({ queryKey: ['app', 'memory'] })
    }
  })

  const unload = useCallback((model: string): void => mutation.mutate(model), [mutation])

  const state = useMemo((): ViewState<LoadedModel[]> => {
    if (isPending) return { status: 'loading' }
    if (isError || data === undefined) {
      return { status: 'error', error: { kind: 'unknown', message: 'ai:loaded' } }
    }
    if (!data.ok) return { status: 'error', error: data.error }
    return data.value.length === 0 ? { status: 'empty' } : { status: 'ready', data: data.value }
  }, [data, isPending, isError])

  return useMemo(
    () => ({ state, unload, unloading: mutation.isPending }),
    [state, unload, mutation.isPending]
  )
}
