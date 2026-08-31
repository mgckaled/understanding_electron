import { useQuery } from '@tanstack/react-query'
import type { AppIpcStat } from '@shared/ipc'
import StateView from '../../shared/ui/StateView'
import type { ViewState } from '../../shared/ui/state'

const CELL = 'px-3 py-2 text-xs'

function IpcChannelsTable({ stats }: { stats: AppIpcStat[] }): React.JSX.Element {
  const state: ViewState<AppIpcStat[]> =
    stats.length === 0 ? { status: 'empty' } : { status: 'ready', data: stats }

  return (
    <StateView
      state={state}
      emptyMessage="Nenhum canal chamado ainda."
      render={(channels) => (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border text-2xs tracking-[0.04em] text-text-faint uppercase">
              <th className={CELL}>Canal</th>
              <th className={`${CELL} text-right`}>Chamadas</th>
              <th className={`${CELL} text-right`}>Falhas</th>
              <th className={`${CELL} text-right`}>Última duração</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((stat) => (
              <tr key={stat.channel} className="border-b border-border last:border-b-0">
                <td className={`${CELL} font-mono text-text select-text`}>{stat.channel}</td>
                <td className={`${CELL} text-right font-mono text-text-muted`}>{stat.callCount}</td>
                <td
                  className={`${CELL} text-right font-mono ${stat.errorCount > 0 ? 'text-danger-text' : 'text-text-muted'}`}
                  title={stat.lastError ?? undefined}
                >
                  {stat.errorCount}
                </td>
                <td className={`${CELL} text-right font-mono text-text-muted`}>
                  {stat.lastDurationMs.toFixed(1).replace('.', ',')} ms
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    />
  )
}

function ActivityPanel(): React.JSX.Element {
  // staleTime 0 for the three — same reasoning as ProcessesPanel (O-1): these
  // change on their own while the app runs, so a cached answer would be
  // stale by construction. No refetchInterval (DO2.2 of O-2): reopening the
  // panel is the refresh, this is not meant to be watched live.
  const ipcStats = useQuery({
    queryKey: ['app', 'ipcStats'],
    queryFn: () => window.api.app.ipcStats(),
    staleTime: 0
  })
  const jobs = useQuery({
    queryKey: ['job', 'list'],
    queryFn: () => window.api.job.list(),
    staleTime: 0
  })
  const queueDepth = useQuery({
    queryKey: ['dataset', 'queueDepth'],
    queryFn: () => window.api.dataset.queueDepth(),
    staleTime: 0
  })

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h3 className="mb-4 text-sm text-text">Canais IPC</h3>
        {ipcStats.data && <IpcChannelsTable stats={ipcStats.data} />}
      </div>
      <div>
        <h3 className="mb-4 text-sm text-text">Jobs ativos</h3>
        <p className="mb-2 text-xs text-text-muted">{jobs.data?.length ?? 0} em andamento</p>
        {jobs.data && jobs.data.length > 0 && (
          <ul className="flex flex-col gap-1 font-mono text-2xs text-text-muted select-text">
            {jobs.data.map((jobId) => (
              <li key={jobId}>{jobId}</li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-4 text-sm text-text">Fila do worker DuckDB</h3>
        <p className="text-xs text-text-muted">
          {queueDepth.data ?? 0} {queueDepth.data === 1 ? 'requisição' : 'requisições'} em voo
        </p>
      </div>
    </section>
  )
}

export default ActivityPanel
