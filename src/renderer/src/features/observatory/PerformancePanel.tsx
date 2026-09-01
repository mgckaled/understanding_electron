import { useQuery } from '@tanstack/react-query'
import type { PerformanceSummary } from '@shared/ipc'
import { useSettings } from '../settings/settingsContext'
import StateView from '../../shared/ui/StateView'
import type { ViewState } from '../../shared/ui/state'

const CELL = 'px-3 py-2.5 text-xs'

function formatTokensPerSec(value: number): string {
  return `${value.toFixed(1).replace('.', ',')} tok/s`
}

/** Under a second in ms, over it in seconds — both units read naturally at their own scale. */
function formatDurationMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1).replace('.', ',')}s`
}

function StackedCell({ top, bottom }: { top: string; bottom: string }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-xs text-text select-text">{top}</span>
      <span className="font-mono text-2xs text-text-faint">{bottom}</span>
    </div>
  )
}

function PerformanceTable({ summaries }: { summaries: PerformanceSummary[] }): React.JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border text-2xs tracking-[0.04em] text-text-faint uppercase">
            <th className={CELL}>Modelo</th>
            <th className={`${CELL} text-right`}>N</th>
            {/* Three-way split promised in reference/observatory/README.md § 9.2: rede+prefill, decode, tokens/s. */}
            <th className={`${CELL} text-right`}>Rede+Prefill / Decode</th>
            <th className={`${CELL} text-right`}>Entrada / Saída tok/s</th>
            <th className={`${CELL} text-right`}>Mediana saída</th>
            <th className={`${CELL} text-right`}>P90 saída</th>
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
                <StackedCell top={summary.model} bottom={summary.service} />
              </td>
              <td className={`${CELL} text-right font-mono text-text-muted`}>{summary.n}</td>
              <td className={`${CELL} text-right`}>
                <StackedCell
                  top={formatDurationMs(summary.avgNetworkPrefillMs)}
                  bottom={formatDurationMs(summary.avgDecodeMs)}
                />
              </td>
              <td className={`${CELL} text-right`}>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-2xs text-text-faint">
                    {summary.avgInputTokensPerSec === null
                      ? '—'
                      : formatTokensPerSec(summary.avgInputTokensPerSec)}
                  </span>
                  <span className="font-mono text-xs font-semibold text-text select-text">
                    {formatTokensPerSec(summary.avgOutputTokensPerSec)}
                  </span>
                </div>
              </td>
              <td className={`${CELL} text-right font-mono text-text-muted`}>
                {formatTokensPerSec(summary.medianOutputTokensPerSec)}
              </td>
              <td className={`${CELL} text-right font-mono text-text-muted`}>
                {formatTokensPerSec(summary.p90OutputTokensPerSec)}
              </td>
              <td className={`${CELL} text-right font-mono text-text-faint`}>
                {summary.maxLoadDurationMs === null
                  ? '—'
                  : formatDurationMs(summary.maxLoadDurationMs)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
