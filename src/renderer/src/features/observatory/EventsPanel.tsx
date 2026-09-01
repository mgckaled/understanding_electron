import { useQuery } from '@tanstack/react-query'
import type { EventRow } from '@shared/ipc'
import { useSettings } from '../settings/settingsContext'
import { formatAge } from '../../shared/format'
import StateView from '../../shared/ui/StateView'
import type { ViewState } from '../../shared/ui/state'

const CELL = 'px-3 py-2 text-xs'

function EventsTable({ rows }: { rows: EventRow[] }): React.JSX.Element {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-border text-2xs tracking-[0.04em] text-text-faint uppercase">
          <th className={CELL}>Canal</th>
          <th className={CELL}>Duração</th>
          <th className={CELL}>Erro</th>
          <th className={CELL}>Domínio</th>
          <th className={CELL}>Quando</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-border last:border-b-0">
            <td className={`${CELL} font-mono text-text select-text`}>{row.channel}</td>
            <td className={`${CELL} text-text-muted`}>{row.durationMs.toFixed(1)}ms</td>
            <td className={`${CELL} text-danger-text select-text`}>{row.error ?? '—'}</td>
            <td className={`${CELL} font-mono text-text-muted select-text`}>
              {row.domainId ?? '—'}
            </td>
            <td className={`${CELL} text-text-muted`}>{formatAge(row.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function EventsPanel(): React.JSX.Element {
  const { settings } = useSettings()
  const retentionDays = settings.eventRetentionDays ?? 30

  // Barato (§ 6, § 5.1): reads on every open, same discipline as DatabasePanel.
  const { data, isPending, isError } = useQuery({
    queryKey: ['events', 'list'],
    queryFn: () => window.api.events.list(),
    staleTime: 0
  })

  const state: ViewState<EventRow[]> = isPending
    ? { status: 'loading' }
    : isError || data === undefined
      ? { status: 'error', error: { kind: 'unknown', message: 'events:list' } }
      : data.length === 0
        ? { status: 'empty' }
        : { status: 'ready', data }

  return (
    <section>
      <h3 className="mb-1 text-sm text-text">Eventos</h3>
      {/* DO6.7(b) — an empty-looking history that was actually pruned must say so. */}
      <p className="mb-4 text-xs text-text-faint">
        Mostrando eventos dos últimos {retentionDays} dias — o resto já foi descartado.
      </p>
      <StateView state={state} render={(rows) => <EventsTable rows={rows} />} />
    </section>
  )
}

export default EventsPanel
