import { useId, useState } from 'react'
import { tableFromIPC } from 'apache-arrow'
import { Trash2, Undo2 } from 'lucide-react'
import type { ColumnProfile, Step, StepProposalPart } from '@shared/ipc'
import { describeStep } from '@core/pipeline/describe'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Button from '../../shared/ui/Button/Button'
import Dialog from '../../shared/ui/Dialog/Dialog'
import { errorMessage } from '../../shared/ui/messages'
import DatasetTable from './DatasetTable'

// Judgment, not measurement (same label as qualifiesForTopValues,
// RAM_MARGIN_BYTES) — below this, a jump reads as normal sampling noise
// across a transform, not the silent damage D19.6 exists to catch (a type
// conversion turning a mostly-filled column mostly-null).
const NULL_JUMP_THRESHOLD = 10

interface ApplyResult {
  columns: string[]
  rows: unknown[][]
  before: ColumnProfile[]
  after: ColumnProfile[]
}

type ApplyState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; result: ApplyResult }

interface NullJump {
  column: string
  before: number
  after: number
}

/**
 * Compares nullPercentage per column, before vs. after (D19.6) — never row
 * count: zero rows after a filter is often the CORRECT result, and an alarm
 * there would be noise the user learns to ignore.
 */
function nullJumps(before: ColumnProfile[], after: ColumnProfile[]): NullJump[] {
  const beforeByColumn = new Map(before.map((profile) => [profile.column, profile.nullPercentage]))
  const jumps: NullJump[] = []
  for (const profile of after) {
    const previous = beforeByColumn.get(profile.column)
    if (previous !== undefined && profile.nullPercentage - previous >= NULL_JUMP_THRESHOLD) {
      jumps.push({ column: profile.column, before: previous, after: profile.nullPercentage })
    }
  }
  return jumps
}

/**
 * A model's step proposal, editable before it runs (D19.1/D19.2) — remove a
 * step, then Aplicar compiles what remains through dataset:transform. No
 * manual step construction (out of scope, D19's own "o que não esperar").
 */
function StepProposalCard({ part }: { part: StepProposalPart }): React.JSX.Element {
  const [steps, setSteps] = useState<Step[]>(part.steps)
  const [state, setState] = useState<ApplyState>({ status: 'idle' })
  // Removing a step cannot be undone once Aplicar runs on what remains — the
  // user asked for a confirm step here after finding the plain click too easy
  // to trigger by accident, with no way back.
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null)
  const removalDescriptionId = useId()

  async function handleApply(): Promise<void> {
    setState({ status: 'loading' })
    const response = await window.api.dataset.transform(part.hash, steps)
    if (!response.ok) {
      setState({ status: 'error', message: errorMessage(response.error) })
      return
    }

    const table = tableFromIPC(response.value.bytes)
    const columns = table.schema.fields.map((field) => field.name)
    const rows: unknown[][] = []
    for (const row of table) rows.push(row.toArray())

    setState({
      status: 'ready',
      result: { columns, rows, before: response.value.before, after: response.value.after }
    })
  }

  function removeStep(index: number): void {
    setSteps((current) => current.filter((_, position) => position !== index))
  }

  function confirmRemoval(): void {
    if (pendingRemoval === null) return
    removeStep(pendingRemoval)
    setPendingRemoval(null)
  }

  const jumps = state.status === 'ready' ? nullJumps(state.result.before, state.result.after) : []

  return (
    <div className="flex max-w-[80%] flex-col gap-3 rounded-lg border border-border bg-surface-raised px-5 py-4 text-text">
      {steps.length === 0 ? (
        <p className="text-sm text-text-faint">Nenhum passo restante.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {steps.map((step, index) => (
            <li key={index} className="flex items-center gap-2">
              <span className="flex-1 text-sm">{describeStep(step)}</span>
              {/* text-danger-text, never the solid danger fill, as an icon on a
                  transparent button (D10.1) — the fill is for Remover below,
                  the actual destructive action, not this trigger. */}
              <Button
                variant="outline"
                size="sm"
                shape="circle"
                className="flex-none"
                onClick={() => setPendingRemoval(index)}
                aria-label={`Remover passo ${index + 1}`}
              >
                <Trash2
                  className="text-danger-text"
                  size={ICON_SIZE.sm}
                  strokeWidth={ICON_STROKE}
                />
              </Button>
            </li>
          ))}
        </ol>
      )}
      <div>
        <Button
          variant="primary"
          size="sm"
          loading={state.status === 'loading'}
          disabled={steps.length === 0}
          onClick={() => void handleApply()}
        >
          Aplicar
        </Button>
      </div>
      {state.status === 'error' && (
        <p className="text-xs text-danger-text selectable" role="alert">
          {state.message}
        </p>
      )}
      {state.status === 'ready' && (
        <div className="flex flex-col gap-2">
          {jumps.length > 0 && (
            <p className="text-xs text-warn-text selectable" role="alert">
              Atenção:{' '}
              {jumps
                .map(
                  (jump) =>
                    `${jump.column} foi de ${jump.before.toFixed(1)}% para ${jump.after.toFixed(1)}% de valores nulos`
                )
                .join('; ')}
              .
            </p>
          )}
          <DatasetTable columns={state.result.columns} rows={state.result.rows} />
        </div>
      )}
      <Dialog
        open={pendingRemoval !== null}
        title="Remover passo"
        onClose={() => setPendingRemoval(null)}
        describedBy={removalDescriptionId}
      >
        <p className="mb-6 text-sm" id={removalDescriptionId}>
          Deseja remover o passo de forma definitiva?
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setPendingRemoval(null)}>
            <span className="flex items-center gap-2">
              <Undo2 size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
              Cancelar
            </span>
          </Button>
          <Button variant="danger" size="sm" onClick={confirmRemoval}>
            <span className="flex items-center gap-2">
              <Trash2 size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
              Remover
            </span>
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

export default StepProposalCard
