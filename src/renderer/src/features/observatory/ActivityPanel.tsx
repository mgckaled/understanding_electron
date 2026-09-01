import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { AppIpcStat, JobId } from '@shared/ipc'
import StateView from '../../shared/ui/StateView'
import type { ViewState } from '../../shared/ui/state'

const CELL = 'px-3 py-2 text-xs'

/** A pending/error read must not read as "0" or "nothing" — that is the reading a failed count would produce. */
function toViewState<T>(
  query: UseQueryResult<T>,
  channel: string,
  isEmpty: (data: T) => boolean
): ViewState<T> {
  if (query.isPending) return { status: 'loading' }
  if (query.isError) return { status: 'error', error: { kind: 'unknown', message: channel } }
  if (isEmpty(query.data)) return { status: 'empty' }
  return { status: 'ready', data: query.data }
}

function IpcChannelsTable({ channels }: { channels: AppIpcStat[] }): React.JSX.Element {
  return (
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
            <td className={`${CELL} font-mono text-text select-text`}>
              {stat.channel}
              {stat.errorCount > 0 && stat.lastError && (
                <div className="mt-0.5 text-2xs text-danger-text select-text">{stat.lastError}</div>
              )}
            </td>
            <td className={`${CELL} text-right font-mono text-text-muted`}>{stat.callCount}</td>
            <td
              className={`${CELL} text-right font-mono ${stat.errorCount > 0 ? 'text-danger-text' : 'text-text-muted'}`}
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
  )
}

function JobsList({ jobs }: { jobs: JobId[] }): React.JSX.Element {
  return (
    <>
      <p className="mb-2 text-xs text-text-muted">{jobs.length} em andamento</p>
      <ul className="flex flex-col gap-1 font-mono text-2xs text-text-muted select-text">
        {jobs.map((jobId) => (
          <li key={jobId}>{jobId}</li>
        ))}
      </ul>
    </>
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
        <StateView
          state={toViewState(ipcStats, 'app:ipcStats', (data) => data.length === 0)}
          emptyMessage="Nenhum canal chamado ainda."
          render={(channels) => <IpcChannelsTable channels={channels} />}
        />
      </div>
      <div>
        <h3 className="mb-4 text-sm text-text">Jobs ativos</h3>
        <StateView
          state={toViewState(jobs, 'job:list', (data) => data.length === 0)}
          emptyMessage="0 em andamento"
          render={(data) => <JobsList jobs={data} />}
        />
      </div>
      <div>
        <h3 className="mb-4 text-sm text-text">Fila do worker DuckDB</h3>
        <StateView
          state={toViewState(queueDepth, 'dataset:queueDepth', () => false)}
          render={(depth) => (
            <p className="text-xs text-text-muted">
              {depth} {depth === 1 ? 'requisição' : 'requisições'} em voo
            </p>
          )}
        />
      </div>
    </section>
  )
}

export default ActivityPanel
