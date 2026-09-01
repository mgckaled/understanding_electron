import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatBytes } from '../../shared/format'
import Button from '../../shared/ui/Button/Button'
import StateView from '../../shared/ui/StateView'
import type { ViewState } from '../../shared/ui/state'

const QUERY_KEY = ['session', 'cacheSize']

function ChromiumCachePanel(): React.JSX.Element {
  const queryClient = useQueryClient()
  // Acessível (§ 5.1): cache obrigatório — no staleTime override, so this
  // inherits the QueryClient's global staleTime: Infinity (createQueryClient
  // comment) instead of DatabasePanel/EnginePanel's staleTime: 0. Switching
  // panels and back never re-pays the read; only clearCache's own
  // invalidateQueries forces a fresh one.
  const { data, isPending, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => window.api.session.cacheSize()
  })
  const clear = useMutation({
    mutationFn: () => window.api.session.clearCache(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  })

  const state: ViewState<number> = isPending
    ? { status: 'loading' }
    : isError || data === undefined
      ? { status: 'error', error: { kind: 'unknown', message: 'session:cacheSize' } }
      : { status: 'ready', data }

  return (
    <section>
      <h3 className="mb-4 text-sm text-text">Cache do Chromium</h3>
      <StateView
        state={state}
        render={(bytes) => (
          <div className="flex flex-col gap-4">
            {/* getCacheSize() covers only the HTTP cache — Code Cache/ and
                GPUCache/ have no equivalent Electron API and show up under
                "Uso de disco" instead (O-5, DO5.2). */}
            <p className="text-xs text-text-muted">
              Cache HTTP do motor embutido: <span className="text-text">{formatBytes(bytes)}</span>
            </p>
            <Button
              variant="secondary"
              loading={clear.isPending}
              onClick={() => clear.mutate()}
              className="self-start"
            >
              Limpar cache
            </Button>
          </div>
        )}
      />
    </section>
  )
}

export default ChromiumCachePanel
