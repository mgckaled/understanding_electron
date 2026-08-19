import { useState } from 'react'
import { tableFromIPC } from 'apache-arrow'
import Button from '../../shared/ui/Button/Button'
import { errorMessage } from '../../shared/ui/messages'

// Mirrors the app-wide DOM row cap (CLAUDE.md) — the channel already caps at
// 201 (D18B.4, the N+1 truncation trick), so this only ever drops the extra
// row this component itself asked for.
const ROW_LIMIT = 200

interface QueryResult {
  columns: string[]
  rows: unknown[][]
  truncated: boolean
}

// Row iteration, not the vector's own .toArray() — a vector's toArray()
// reads the raw typed array and turns null slots into 0, silently. Row
// proxies go through the per-field getter instead, which checks validity.
function arrowBytesToResult(bytes: Uint8Array): QueryResult {
  const table = tableFromIPC(bytes)
  const columns = table.schema.fields.map((field) => field.name)
  const rows: unknown[][] = []
  for (const row of table) {
    rows.push(row.toArray())
  }
  const truncated = rows.length > ROW_LIMIT
  return { columns, rows: truncated ? rows.slice(0, ROW_LIMIT) : rows, truncated }
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '∅'
  if (typeof value === 'bigint') return value.toString()
  return String(value)
}

// The raw-SQL diagnostic tool D18B.5 describes — one input, one button, one
// result table. No history, no saved queries: that is plano 19's job.
function DatasetQueryPanel({ hash }: { hash: string }): React.JSX.Element {
  const [sql, setSql] = useState('SELECT * FROM dataset')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<QueryResult | null>(null)

  async function handleRun(): Promise<void> {
    setLoading(true)
    setError(null)
    const response = await window.api.dataset.query(hash, sql)
    setLoading(false)
    if (!response.ok) {
      setError(errorMessage(response.error))
      setResult(null)
      return
    }
    setResult(arrowBytesToResult(response.value))
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <textarea
        className="min-h-[72px] resize-y rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-text selectable"
        value={sql}
        onChange={(event) => setSql(event.target.value)}
        aria-label="Consulta SQL"
        spellCheck={false}
      />
      <div>
        <Button
          variant="primary"
          size="sm"
          loading={loading}
          disabled={sql.trim().length === 0}
          onClick={() => void handleRun()}
        >
          Executar
        </Button>
      </div>
      {error && (
        <p className="text-xs text-danger-text selectable" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="flex flex-col gap-2">
          {result.truncated && (
            <p className="text-xs text-text-faint">
              Mostrando as primeiras {ROW_LIMIT.toLocaleString('pt-BR')} linhas.
            </p>
          )}
          <div className="max-h-[400px] overflow-auto rounded-md border border-border">
            <table className="w-full border-collapse text-xs selectable">
              <thead>
                <tr>
                  {result.columns.map((column) => (
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
                {result.rows.map((row, rowIndex) => (
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
      )}
    </div>
  )
}

export default DatasetQueryPanel
