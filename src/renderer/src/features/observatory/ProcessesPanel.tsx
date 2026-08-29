import { useQuery } from '@tanstack/react-query'
import type { AppProcess, AppProcessType } from '@shared/ipc'
import { formatSize } from '../../shared/format'
import StateView from '../../shared/ui/StateView'
import type { ViewState } from '../../shared/ui/state'

// Electron's own vocabulary, which is not the user's: `Browser` is this app's
// main process and `Tab` is a window, not anything a browser tab.
const TYPE_LABELS: Record<AppProcessType, string> = {
  Browser: 'Principal',
  Tab: 'Janela',
  Utility: 'Utilitário',
  Zygote: 'Zygote',
  'Sandbox helper': 'Sandbox',
  GPU: 'GPU',
  'Pepper Plugin': 'Plugin',
  'Pepper Plugin Broker': 'Plugin (broker)',
  Unknown: 'Desconhecido'
}

const CELL = 'px-3 py-2 text-xs'

function ProcessesPanel(): React.JSX.Element {
  // staleTime 0, unlike app:info: this changes on its own while the app runs,
  // so a cached answer would be stale by construction (the useLoadedModels rule).
  const { data, isPending, isError } = useQuery({
    queryKey: ['app', 'processes'],
    queryFn: () => window.api.app.processes(),
    staleTime: 0
  })

  const state: ViewState<AppProcess[]> = isPending
    ? { status: 'loading' }
    : isError || data === undefined
      ? { status: 'error', error: { kind: 'unknown', message: 'app:processes' } }
      : data.length === 0
        ? { status: 'empty' }
        : { status: 'ready', data }

  return (
    <section>
      <h3 className="mb-4 text-sm text-text">Processos</h3>
      <StateView
        state={state}
        emptyMessage="Nenhum processo relatado."
        render={(processes) => (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border text-2xs tracking-[0.04em] text-text-faint uppercase">
                <th className={CELL}>Processo</th>
                <th className={CELL}>PID</th>
                <th className={`${CELL} text-right`}>CPU</th>
                <th className={`${CELL} text-right`}>Memória</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((process) => (
                <tr key={process.pid} className="border-b border-border last:border-b-0">
                  <td className={`${CELL} text-text`}>
                    {TYPE_LABELS[process.type] ?? process.type}
                    {process.name && <span className="text-text-muted"> · {process.name}</span>}
                  </td>
                  <td className={`${CELL} font-mono text-text-muted select-text`}>{process.pid}</td>
                  <td className={`${CELL} text-right font-mono text-text-muted`}>
                    {process.cpuPercent.toFixed(1).replace('.', ',')} %
                  </td>
                  <td className={`${CELL} text-right font-mono text-text`}>
                    {formatSize(process.memoryBytes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      />
    </section>
  )
}

export default ProcessesPanel
