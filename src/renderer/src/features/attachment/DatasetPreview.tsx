import type { DatasetPart } from '@shared/ipc'
import { errorMessage } from '../../shared/ui/messages'
import { useDatasetPreview } from './useDatasetPreview'

// Mirrors the LIMIT baked into useDatasetPreview's SQL (D18C.2) — kept as a
// second constant, not imported, because the hook's cap is SQL text and this
// one is a display threshold; the two happen to share a value, not an owner.
const PREVIEW_ROW_CAP = 50

// Second occurrence of "format an Arrow cell for display" (D18C.6) — copied
// from DatasetQueryPanel.formatCell, not extracted: régua dos três reserves
// extraction for a third occurrence.
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '∅'
  if (typeof value === 'bigint') return value.toString()
  return String(value)
}

/**
 * The dataset's first 50 rows, rendered by default inside DatasetCard — no
 * click, fired the moment the card mounts. Renders every ViewState branch as
 * text or a table, never a blank section: a silent gap here would read as
 * the card breaking rather than loading. DatasetCard swaps this out for
 * DatasetQueryPanel while Consultar is open, so the two never show a table
 * at the same time (post-18-C fix, see HISTORY.md).
 */
function DatasetPreview({ part }: { part: DatasetPart }): React.JSX.Element {
  const state = useDatasetPreview(part.hash)

  if (state.status === 'loading') {
    return (
      <p className="text-xs text-text-muted" role="status">
        Carregando pré-visualização…
      </p>
    )
  }

  if (state.status === 'error') {
    return (
      <p className="text-xs text-danger-text selectable" role="alert">
        {errorMessage(state.error)}
      </p>
    )
  }

  if (state.status === 'empty') {
    return <p className="text-xs text-text-muted">Arquivo sem linhas de dado.</p>
  }

  // useDatasetPreview only ever produces loading/error/empty/ready — idle
  // and cancelled are unreachable here, kept only so ViewState's full union
  // still narrows.
  if (state.status !== 'ready') return <></>

  const table = state.data
  // Column names come from the engine's own schema (read_csv_auto), never
  // from part.columns (scanDelimited) — the two sniffers can disagree on an
  // ambiguous CSV (D18C.7), and rendering the engine's own answer is what
  // makes that disagreement visible instead of hidden.
  const columns = table.schema.fields.map((field) => field.name)
  // Row iteration, not the vector's own .toArray() — see
  // DatasetQueryPanel.arrowBytesToResult for the NULL-corrupting armadilha.
  const rows: unknown[][] = []
  for (const row of table) {
    rows.push(row.toArray())
  }

  return (
    <div className="flex flex-col gap-2">
      {part.rowCount > PREVIEW_ROW_CAP && (
        <p className="text-xs text-text-faint">
          Mostrando as primeiras {PREVIEW_ROW_CAP} de {part.rowCount.toLocaleString('pt-BR')}{' '}
          linhas.
        </p>
      )}
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
                  <td
                    key={cellIndex}
                    className="border-b border-border px-2 py-1 whitespace-nowrap"
                  >
                    {formatCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DatasetPreview
