import { formatCell } from './formatCell'

// Third consumer (StepProposalCard, D19.6) — the régua dos três's extraction
// trigger. DatasetQueryPanel and DatasetPreview each carried their own copy
// of this exact table markup until now; both are updated to import from
// here instead of keeping a third copy alive.
function DatasetTable({
  columns,
  rows
}: {
  columns: string[]
  rows: unknown[][]
}): React.JSX.Element {
  return (
    <div className="max-h-[400px] overflow-auto rounded-md border border-border">
      <table className="w-full border-collapse text-xs selectable">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="sticky top-0 border-b border-border bg-surface-raised px-2 py-1 text-left font-semibold whitespace-nowrap"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border-b border-border px-2 py-1 whitespace-nowrap">
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
