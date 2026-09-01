import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { LoadedModel } from '@shared/ipc'
import { formatSize } from '../../shared/format'
import Button from '../../shared/ui/Button/Button'
import StateView from '../../shared/ui/StateView'
import type { ViewState } from '../../shared/ui/state'

const SERVICE = 'ollama' as const

/** Minutes until the provider drops it on its own; null when already due. */
function minutesLeft(expiresAt: number): number | null {
  const ms = expiresAt - Date.now()
  return ms > 0 ? Math.ceil(ms / 60_000) : null
}

/**
 * The section formerly known as Configurações' `LoadedModels` (O-1), moved
 * whole into Capacidades (O-4, DO4.7). No query of its own: `state` comes
 * from the same sondagem `CapabilitiesPanel` already ran, and "Descarregar"
 * re-runs that same sondagem via `onUnloaded` instead of a separate refetch.
 */
function LoadedModels({
  state,
  onUnloaded
}: {
  state: ViewState<LoadedModel[]>
  onUnloaded: () => void
}): React.JSX.Element {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (model: string) => window.api.ai.unload(SERVICE, model),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['app', 'memory'] })
      onUnloaded()
    }
  })
  const unload = useCallback((model: string): void => mutation.mutate(model), [mutation])

  return (
    <section>
      <h3 className="mb-3 text-sm text-text">Em memória</h3>
      <StateView
        state={state}
        emptyMessage="Nenhum modelo carregado."
        render={(models) => (
          <ul className="flex flex-col gap-3">
            {models.map((model) => {
              const left = minutesLeft(model.expiresAt)
              return (
                <li
                  key={model.name}
                  className="flex items-center gap-4 rounded-md border border-border bg-surface-sunken px-4 py-3"
                >
                  <span className="flex-1 font-mono text-xs text-text select-text">
                    {model.name}
                  </span>
                  <span className="text-2xs text-text-muted whitespace-nowrap">
                    {formatSize(model.sizeBytes)}
                    {left === null ? '' : ` · sai em ~${left} min`}
                  </span>
                  <Button
                    variant="secondary"
                    loading={mutation.isPending}
                    onClick={() => unload(model.name)}
                  >
                    Descarregar
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      />
    </section>
  )
}

export default LoadedModels
