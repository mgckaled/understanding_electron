import { useQuery } from '@tanstack/react-query'
import type { DatabaseInfo } from '@shared/ipc'
import { formatBytes } from '../../shared/format'
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

function TablesTable({ info }: { info: DatabaseInfo }): React.JSX.Element {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-border text-2xs tracking-[0.04em] text-text-faint uppercase">
          <th className={CELL}>Tabela</th>
          <th className={`${CELL} text-right`}>Linhas</th>
        </tr>
      </thead>
      <tbody>
        {info.tables.map((table) => (
          <tr key={table.name} className="border-b border-border last:border-b-0">
            <td className={`${CELL} font-mono text-text select-text`}>{table.name}</td>
            <td className={`${CELL} text-right font-mono text-text-muted`}>{table.rowCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DatabasePanel(): React.JSX.Element {
  // staleTime 0, same discipline as EnginePanel/ActivityPanel (O-2's DO2.2):
  // reopening the panel is the refresh, no refetchInterval.
  const { data, isPending, isError } = useQuery({
    queryKey: ['database', 'info'],
    queryFn: () => window.api.database.info(),
    staleTime: 0
  })

  const state: ViewState<DatabaseInfo> = isPending
    ? { status: 'loading' }
    : isError || data === undefined
      ? { status: 'error', error: { kind: 'unknown', message: 'database:info' } }
      : { status: 'ready', data }

  return (
    <section>
      <h3 className="mb-4 text-sm text-text">Banco de dados</h3>
      <StateView
        state={state}
        render={(info) => (
          <div className="flex flex-col gap-6">
            <dl className="flex flex-col">
              <Row label="Versão de migração" value={String(info.migrationVersion)} />
              <Row label="Tamanho" value={formatBytes(info.sizeBytes)} />
              <Row label="Páginas livres" value={String(info.freelistCount)} />
            </dl>
            <div>
              <h4 className="mb-2 text-xs text-text-muted uppercase">Tabelas</h4>
              <TablesTable info={info} />
            </div>
          </div>
        )}
      />
    </section>
  )
}

export default DatabasePanel
