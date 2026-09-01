import { useQuery } from '@tanstack/react-query'
import type { PerformanceSummary } from '@shared/ipc'
import { useSettings } from '../settings/settingsContext'
import StateView from '../../shared/ui/StateView'
import type { ViewState } from '../../shared/ui/state'

const CELL = 'px-3 py-2.5 text-xs'

function formatTokensPerSec(value: number): string {
  return `${value.toFixed(1).replace('.', ',')} tok/s`
}

function formatLoadDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace('.', ',')}s`
}

function PerformanceTable({ summaries }: { summaries: PerformanceSummary[] }): React.JSX.Element {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-border text-2xs tracking-[0.04em] text-text-faint uppercase">
          <th className={CELL}>Modelo</th>
          <th className={`${CELL} text-right`}>N</th>
          <th className={`${CELL} text-right`}>Média</th>
          <th className={`${CELL} text-right`}>Mediana</th>
          <th className={`${CELL} text-right`}>P90</th>
          <th className={`${CELL} text-right`}>Carga (pico)</th>
        </tr>
      </thead>
      <tbody>
        {summaries.map((summary) => (
          <tr
            key={`${summary.service}:${summary.model}`}
            className="border-b border-border last:border-b-0"
          >
            <td className={CELL}>
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-xs text-text select-text">{summary.model}</span>
                <span className="text-2xs tracking-[0.04em] text-text-faint uppercase">
                  {summary.service}
                </span>
              </div>
            </td>
            <td className={`${CELL} text-right font-mono text-text-muted`}>{summary.n}</td>
            <td className={`${CELL} text-right font-mono font-semibold text-text`}>
              {formatTokensPerSec(summary.avgTokensPerSec)}
            </td>
            <td className={`${CELL} text-right font-mono text-text-muted`}>
              {formatTokensPerSec(summary.medianTokensPerSec)}
            </td>
            <td className={`${CELL} text-right font-mono text-text-muted`}>
              {formatTokensPerSec(summary.p90TokensPerSec)}
            </td>
            <td className={`${CELL} text-right font-mono text-text-faint`}>
              {summary.maxLoadDurationMs === null
                ? '—'
                : formatLoadDuration(summary.maxLoadDurationMs)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * Reads on every open, same discipline as EventsPanel (Barato, § 6) — the
 * summary is already aggregated in the main process (O-7, DO7.5), so this
 * component never sees a raw row.
 */
function PerformancePanel(): React.JSX.Element {
  const { settings } = useSettings()
  const retentionDays = settings.eventRetentionDays ?? 30

  const { data, isPending, isError } = useQuery({
    queryKey: ['performance', 'list'],
    queryFn: () => window.api.performance.list(),
    staleTime: 0
  })

  const state: ViewState<PerformanceSummary[]> = isPending
    ? { status: 'loading' }
    : isError || data === undefined
      ? { status: 'error', error: { kind: 'unknown', message: 'performance:list' } }
      : data.length === 0
        ? { status: 'empty' }
        : { status: 'ready', data }

  return (
    <section>
      <h3 className="mb-1 text-sm text-text">Desempenho</h3>
      {/* Same rule as EventsPanel (DO6.7(b)/DO7.6): an empty-looking summary that was actually pruned must say so. */}
      <p className="mb-4 text-xs text-text-faint">
        Mostrando o resumo das respostas dos últimos {retentionDays} dias — o resto já foi
        descartado.
      </p>
      <StateView state={state} render={(summaries) => <PerformanceTable summaries={summaries} />} />
    </section>
  )
}

export default PerformancePanel
