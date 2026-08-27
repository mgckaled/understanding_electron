import { useRef, useState } from 'react'
import { tableFromIPC } from 'apache-arrow'
import Button from '../../shared/ui/Button/Button'
import { errorMessage } from '../../shared/ui/messages'
import DatasetTable from './DatasetTable'

// Mirrors the app-wide DOM row cap (CLAUDE.md) — the channel already caps at
// 201 (D18B.4, the N+1 truncation trick), so this only ever drops the extra
// row this component itself asked for.
const ROW_LIMIT = 200

/** Past this the editor scrolls instead of pushing the result off screen. */
const EDITOR_MAX = 240

interface QueryResult {
  columns: string[]
  rows: unknown[][]
  truncated: boolean
  ms: number
}

// Row iteration, not the vector's own .toArray() — a vector's toArray()
// reads the raw typed array and turns null slots into 0, silently. Row
// proxies go through the per-field getter instead, which checks validity.
function arrowBytesToResult(bytes: Uint8Array, ms: number): QueryResult {
  const table = tableFromIPC(bytes)
  const columns = table.schema.fields.map((field) => field.name)
  const rows: unknown[][] = []
  for (const row of table) {
    rows.push(row.toArray())
  }
  const truncated = rows.length > ROW_LIMIT
  return { columns, rows: truncated ? rows.slice(0, ROW_LIMIT) : rows, truncated, ms }
}

// The raw-SQL diagnostic tool D18B.5 describes, grown into the panel's
// Consulta tab (DF3D.7). No history and no saved queries: still not this.
function DatasetQueryPanel({
  hash,
  fill = false
}: {
  hash: string
  fill?: boolean
}): React.JSX.Element {
  const [sql, setSql] = useState('SELECT * FROM dataset')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<QueryResult | null>(null)
  const editor = useRef<HTMLTextAreaElement>(null)

  function grow(): void {
    const box = editor.current
    if (box === null) return
    box.style.height = 'auto'
    box.style.height = `${Math.min(box.scrollHeight, EDITOR_MAX)}px`
  }

  async function handleRun(): Promise<void> {
    if (sql.trim().length === 0) return
    setRunning(true)
    setError(null)
    const started = performance.now()
    const response = await window.api.dataset.query(hash, sql)
    const ms = Math.round(performance.now() - started)
    setRunning(false)
    if (!response.ok) {
      // The previous result stays: it is what the user was comparing against
      // when the SQL went wrong, and clearing it punishes the typo twice.
      setError(errorMessage(response.error))
      return
    }
    setResult(arrowBytesToResult(response.value, ms))
  }

  return (
    <div
      className={
        fill
          ? 'flex min-h-[0px] flex-1 flex-col'
          : 'flex flex-col gap-3 border-t border-border pt-3'
      }
    >
      <div className={fill ? 'flex flex-none flex-col gap-2 px-5 py-4' : 'flex flex-col gap-3'}>
        <textarea
          ref={editor}
          className="min-h-[72px] resize-none overflow-auto rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-text selectable"
          value={sql}
          onChange={(event) => {
            setSql(event.target.value)
            grow()
          }}
          // Ctrl+Enter is what every SQL tool binds; the button stays, because
          // a shortcut is an accelerator and not the only door.
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault()
              void handleRun()
            }
          }}
          aria-label="Consulta SQL"
          spellCheck={false}
        />
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            className="flex-none"
            loading={running}
            disabled={sql.trim().length === 0}
            onClick={() => void handleRun()}
          >
            Executar
          </Button>
          <span className="font-ui text-xs text-text-faint">Ctrl+Enter</span>
        </div>
        {error !== null && (
          <p className="text-xs text-danger-text selectable" role="alert">
            {error}
          </p>
        )}
      </div>
      {result !== null && (
        <>
          <div
            className={`flex flex-none flex-wrap items-center gap-x-3 font-ui text-xs text-text-muted tabular-nums ${
              fill ? 'border-y border-border px-5 py-2' : ''
            }`}
          >
            <span>
              {result.rows.length.toLocaleString('pt-BR')} linhas ·{' '}
              {result.columns.length.toLocaleString('pt-BR')} colunas · {result.ms} ms
            </span>
            {result.truncated && (
              <span className="text-warn-text">
                mostrando as primeiras {ROW_LIMIT.toLocaleString('pt-BR')}
              </span>
            )}
          </div>
          {/* The table stays put while the next run is in flight, dimmed and
              inert — replacing it with a spinner is what makes a result pane
              jump. */}
          <div
            className={`flex min-h-[0px] flex-1 flex-col transition-opacity duration-(--duration-fast) ease-initial ${
              running ? 'pointer-events-none opacity-60' : ''
            }`}
            aria-busy={running}
          >
            <DatasetTable columns={result.columns} rows={result.rows} fill={fill} />
          </div>
        </>
      )}
    </div>
  )
}

export default DatasetQueryPanel
