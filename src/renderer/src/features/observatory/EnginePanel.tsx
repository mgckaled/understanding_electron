import { useQuery } from '@tanstack/react-query'
import type { DuckDbEngineInfo } from '@shared/ipc'
import { formatSize } from '../../shared/format'
import StateView from '../../shared/ui/StateView'
import type { ViewState } from '../../shared/ui/state'

const CELL = 'px-3 py-2 text-xs'

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="font-mono text-xs text-text select-text">{value}</dd>
    </div>
  )
}

function ExtensionsTable({ info }: { info: DuckDbEngineInfo }): React.JSX.Element {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-border text-2xs tracking-[0.04em] text-text-faint uppercase">
          <th className={CELL}>Extensão</th>
          <th className={CELL}>Estado</th>
          <th className={CELL}>Versão</th>
        </tr>
      </thead>
      <tbody>
        {info.extensions.map((extension) => (
          <tr key={extension.name} className="border-b border-border last:border-b-0">
            <td className={`${CELL} font-mono text-text select-text`}>{extension.name}</td>
            <td className={`${CELL} text-text-muted`}>
              {extension.loaded ? 'carregada' : 'instalada'}
            </td>
            <td className={`${CELL} font-mono text-text-muted select-text`}>
              {extension.version ?? '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function EnginePanel(): React.JSX.Element {
  // staleTime 0, same as ProcessesPanel (O-1): the engine's own memory usage
  // changes while a query runs, so a cached answer is stale by construction.
  // No refetchInterval — reopening the panel is the refresh (DO2.2 of O-2,
  // the same discipline this panel follows).
  const { data, isPending, isError } = useQuery({
    queryKey: ['dataset', 'engineInfo'],
    queryFn: () => window.api.dataset.engineInfo(),
    staleTime: 0
  })

  const state: ViewState<DuckDbEngineInfo> = isPending
    ? { status: 'loading' }
    : isError || data === undefined
      ? { status: 'error', error: { kind: 'unknown', message: 'dataset:engineInfo' } }
      : !data.ok
        ? { status: 'error', error: data.error }
        : { status: 'ready', data: data.value }

  return (
    <section>
      <h3 className="mb-4 text-sm text-text">Motor DuckDB</h3>
      <StateView
        state={state}
        render={(info) => (
          <div className="flex flex-col gap-6">
            <dl className="flex flex-col">
              <Row label="Limite de memória" value={info.memoryLimit} />
            </dl>
            <div>
              <h4 className="mb-2 text-xs text-text-muted uppercase">Extensões</h4>
              <ExtensionsTable info={info} />
            </div>
            {info.memoryByTag.length > 0 && (
              <dl className="flex flex-col">
                <h4 className="mb-2 text-xs text-text-muted uppercase">Memória por categoria</h4>
                {info.memoryByTag.map((entry) => (
                  <Row key={entry.tag} label={entry.tag} value={formatSize(entry.bytes)} />
                ))}
              </dl>
            )}
          </div>
        )}
      />
    </section>
  )
}

export default EnginePanel
