import { formatCell, numericColumns } from './formatCell'

const CELL = 'border-b border-border px-2 py-1 whitespace-nowrap'
const HEAD = `sticky top-[0px] bg-surface-raised text-left font-semibold ${CELL}`

// A bubble caps the table's height; the panel gives it the region that is
// left over. Everything else about the two is identical.
const IN_BUBBLE = 'max-h-[400px] overflow-auto rounded-md border border-border'
const IN_PANEL = 'min-h-[0px] flex-1 overflow-auto px-5 pb-2'

// Third consumer (StepProposalCard, D19.6) — the régua dos três's extraction
// trigger. DatasetQueryPanel and DatasetPreview each carried their own copy
// of this exact table markup until now.
function DatasetTable({
  columns,
  rows,
  fill = false
}: {
  columns: string[]
  rows: unknown[][]
  /** Fills the space it is given instead of capping at 400px. */
  fill?: boolean
}): React.JSX.Element {
  // Numbers right, text left, tabular figures on both — the convention that
  // lets magnitude be compared without reading (DF3D.5).
  const numeric = numericColumns(columns.length, rows)
  const align = (index: number): string => (numeric[index] ? 'text-right tabular-nums' : '')

  return (
    <div className={fill ? IN_PANEL : IN_BUBBLE}>
      <table className="w-full border-collapse text-xs selectable">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={column} className={`${HEAD} ${align(index)}`}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={`${CELL} ${align(cellIndex)}`}>
                  {formatCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DatasetTable
