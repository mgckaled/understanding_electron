import { useQuery } from '@tanstack/react-query'
import type { PrivacyLedger, PrivacyRow } from '@shared/ipc'
import { useSettings } from '../settings/settingsContext'
import { formatAge } from '../../shared/format'
import StateView from '../../shared/ui/StateView'
import type { ViewState } from '../../shared/ui/state'

const CELL = 'px-3 py-2 text-xs'

/** "2 · dataset, imagem" — only the kinds present in this call, never a cumulative total (DO8.5/DO8.8). */
function formatAttachments(row: PrivacyRow): string {
  const total = row.datasetCount + row.documentCount + row.imageCount
  if (total === 0) return '0'
  const kinds: string[] = []
  if (row.datasetCount > 0) kinds.push('dataset')
  if (row.documentCount > 0) kinds.push('documento')
  if (row.imageCount > 0) kinds.push('imagem')
  return `${total} · ${kinds.join(', ')}`
}

function PrivacyTable({ rows }: { rows: PrivacyRow[] }): React.JSX.Element {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-border text-2xs tracking-[0.04em] text-text-faint uppercase">
          <th className={CELL}>Serviço / Modelo</th>
          <th className={CELL}>Anexos nesta chamada</th>
          <th className={CELL}>Quando</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-border last:border-b-0">
            <td className={`${CELL} font-mono text-text select-text`}>
              {row.service} · {row.model}
            </td>
            <td className={`${CELL} text-text-muted select-text`}>{formatAttachments(row)}</td>
            <td className={`${CELL} text-text-muted`}>{formatAge(row.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * Fourth inhabitant of "activity" (O-8) — an audit ledger, not an aggregate
 * like PerformancePanel: every row is one real cloud call. `totalCalls`/
 * `callsWithAttachment` sum over the whole retention window, not just the
 * 200 rows shown below (DO8.8) — most cloud calls carry no attachment, so
 * the header is what keeps that fact visible even when the table itself is
 * dominated by zero-attachment rows.
 */
function PrivacyPanel(): React.JSX.Element {
  const { settings } = useSettings()
  const retentionDays = settings.eventRetentionDays ?? 30

  const { data, isPending, isError } = useQuery({
    queryKey: ['privacy', 'list'],
    queryFn: () => window.api.privacy.list(),
    staleTime: 0
  })

  const state: ViewState<PrivacyLedger> = isPending
    ? { status: 'loading' }
    : isError || data === undefined
      ? { status: 'error', error: { kind: 'unknown', message: 'privacy:list' } }
      : data.rows.length === 0
        ? { status: 'empty' }
        : { status: 'ready', data }

  return (
    <section>
      <h3 className="mb-1 text-sm text-text">Privacidade</h3>
      <p className="mb-4 text-xs text-text-faint">
        {state.status === 'ready'
          ? `${state.data.totalCalls} chamadas de nuvem nos últimos ${retentionDays} dias, ${state.data.callsWithAttachment} com anexo — `
          : ''}
        Mostrando as 200 mais recentes. Chamada local (Ollama) nunca gera linha.
      </p>
      <StateView state={state} render={(ledger) => <PrivacyTable rows={ledger.rows} />} />
    </section>
  )
}

export default PrivacyPanel
