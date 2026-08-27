import type { ColumnProfile } from '@shared/ipc'

const CELL = 'border-b border-border px-2 py-1 whitespace-nowrap'
const HEAD = `sticky top-[0px] bg-surface-raised text-left font-semibold ${CELL}`
const NUM = `${CELL} text-right tabular-nums`

const COLUMNS = ['Coluna', 'Tipo', '% nulos', 'Mín', 'Máx', 'Média', 'Mais frequentes']

const IN_BUBBLE = 'max-h-[400px] overflow-auto rounded-md border border-border'
const IN_PANEL = 'min-h-[0px] flex-1 overflow-auto'

function formatNumber(value: number | null, fractionDigits = 0): string {
  if (value === null) return '—'
  return value.toLocaleString('pt-BR', { maximumFractionDigits: fractionDigits })
}

/** The level-2 profile as a table, for the card's disclosure and the panel's tab. */
function DatasetProfileTable({
  profile,
  fill = false
}: {
  profile: ColumnProfile[]
  /** Fills the space it is given instead of capping at 400px. */
  fill?: boolean
}): React.JSX.Element {
  return (
    <div className={fill ? IN_PANEL : IN_BUBBLE}>
      <table className="w-full border-collapse text-xs selectable">
        <thead>
          <tr>
            {COLUMNS.map((header, index) => (
              <th key={header} className={index >= 2 && index <= 5 ? `${HEAD} text-right` : HEAD}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {profile.map((column) => (
            <tr key={column.column}>
              <td className={CELL}>{column.column}</td>
              <td className={CELL}>{column.type}</td>
              <td className={NUM}>{formatNumber(column.nullPercentage, 1)}%</td>
              <td className={NUM}>{column.min ?? '—'}</td>
              <td className={NUM}>{column.max ?? '—'}</td>
              <td className={NUM}>{formatNumber(column.avg, 2)}</td>
              <td className={CELL}>
                {column.topValues
                  ? column.topValues.map((top) => `${top.value} (${top.count})`).join(', ')
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DatasetProfileTable
