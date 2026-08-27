import { useId, useState } from 'react'
import { tableFromIPC } from 'apache-arrow'
import { Trash2, Undo2 } from 'lucide-react'
import type { ColumnProfile } from '@shared/ipc'
import { describeStep } from '@core/pipeline/describe'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Button from '../../shared/ui/Button/Button'
import Dialog from '../../shared/ui/Dialog/Dialog'
import { errorMessage } from '../../shared/ui/messages'
import { useActiveConversation, useConversations } from '../conversation/conversationsContext'
import DatasetTable from '../attachment/DatasetTable'
import type { Proposal } from './proposalsOf'

// Judgment, not measurement — below this, a jump reads as sampling noise
// across a transform, not the silent damage D19.6 exists to catch.
const NULL_JUMP_THRESHOLD = 10

// Mirrors TRANSFORM_PREVIEW_ROWS in workers/duckdb: the worker caps what it
// sends, and this only says so out loud.
const PREVIEW_ROWS = 200

interface Outcome {
  columns: string[]
  rows: unknown[][]
  before: ColumnProfile[]
  after: ColumnProfile[]
}

type RunState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; outcome: Outcome }

interface NullJump {
  column: string
  before: number
  after: number
}

/** Compares nullPercentage per column, never row count: zero rows after a filter is often correct (D19.6). */
function nullJumps(before: ColumnProfile[], after: ColumnProfile[]): NullJump[] {
  const previous = new Map(before.map((profile) => [profile.column, profile.nullPercentage]))
  const jumps: NullJump[] = []
  for (const profile of after) {
    const was = previous.get(profile.column)
    if (was !== undefined && profile.nullPercentage - was >= NULL_JUMP_THRESHOLD) {
      jumps.push({ column: profile.column, before: was, after: profile.nullPercentage })
    }
  }
  return jumps
}

/**
 * One proposal, editable before it runs.
 *
 * @param rowCount - The dataset's own row count, the left half of the
 *   before-and-after (DF3F.5); the transform only reports column profiles.
 */
function ArtifactSteps({
  proposal,
  hash,
  rowCount
}: {
  proposal: Proposal
  hash: string
  rowCount: number
}): React.JSX.Element {
  const conversation = useActiveConversation()
  const { removeMessage } = useConversations()
  // Positions that are OFF, not the steps that are on: a proposal arrives with
  // everything on, so the empty set is the honest initial value (DF3F.3).
  const [off, setOff] = useState<ReadonlySet<number>>(new Set())
  const [state, setState] = useState<RunState>({ status: 'idle' })
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const groupId = useId()
  const deleteDescriptionId = useId()

  const enabled = proposal.part.steps.filter((_, index) => !off.has(index))

  function toggleStep(index: number): void {
    setOff((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  async function handleRun(): Promise<void> {
    setState({ status: 'loading' })
    const response = await window.api.dataset.transform(hash, enabled)
    if (!response.ok) {
      setState({ status: 'error', message: errorMessage(response.error) })
      return
    }

    const table = tableFromIPC(response.value.bytes)
    const rows: unknown[][] = []
    for (const row of table) rows.push(row.toArray())
    setState({
      status: 'ready',
      outcome: {
        columns: table.schema.fields.map((field) => field.name),
        rows,
        before: response.value.before,
        after: response.value.after
      }
    })
  }

  function confirmDelete(): void {
    if (conversation !== null) removeMessage(conversation.id, proposal.messageId)
    setConfirmingDelete(false)
  }

  const jumps = state.status === 'ready' ? nullJumps(state.outcome.before, state.outcome.after) : []

  return (
    <>
      <div
        className={`flex flex-none flex-col gap-3 px-5 py-4 ${
          state.status === 'loading' ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-text-muted" id={groupId}>
            Proposta do modelo
          </span>
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            className="flex-none"
            onClick={() => setConfirmingDelete(true)}
            aria-label="Excluir proposta"
          >
            <Trash2 className="text-danger-text" size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
          </Button>
        </div>

        {/* A group of checkboxes, not switches: the APG reserves the switch for
            a binary action, and these are items in a list of options (DF3F.8). */}
        <ol className="flex flex-col gap-2" role="group" aria-labelledby={groupId}>
          {proposal.part.steps.map((step, index) => {
            const id = `${groupId}-step-${index}`
            const on = !off.has(index)
            return (
              <li key={index} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id={id}
                  checked={on}
                  onChange={() => toggleStep(index)}
                  className="size-6 flex-none accent-accent"
                />
                <label
                  htmlFor={id}
                  className={`cursor-pointer text-sm ${on ? 'text-text' : 'text-text-faint line-through'}`}
                >
                  {describeStep(step)}
                </label>
              </li>
            )
          })}
        </ol>

        <div>
          <Button
            variant="primary"
            size="sm"
            loading={state.status === 'loading'}
            disabled={enabled.length === 0}
            onClick={() => void handleRun()}
          >
            Ver resultado
          </Button>
        </div>

        {state.status === 'error' && (
          <p className="text-xs text-danger-text selectable" role="alert">
            {state.message}
          </p>
        )}
      </div>

      {state.status === 'ready' && (
        <>
          <div className="flex flex-none flex-col gap-1 border-y border-border px-5 py-2">
            <span className="font-ui text-xs text-text tabular-nums">
              {rowCount.toLocaleString('pt-BR')} →{' '}
              {state.outcome.rows.length.toLocaleString('pt-BR')} linhas ·{' '}
              {state.outcome.before.length} → {state.outcome.after.length} colunas
            </span>
            <span className="font-ui text-2xs text-text-faint">
              Prévia de até {PREVIEW_ROWS} linhas. Nada foi gravado.
            </span>
            {jumps.length > 0 && (
              <span className="text-xs text-warn-text selectable" role="alert">
                {jumps
                  .map(
                    (jump) =>
                      `${jump.column}: ${jump.before.toFixed(1)}% → ${jump.after.toFixed(1)}% de valores nulos`
                  )
                  .join(' · ')}
              </span>
            )}
          </div>
          <DatasetTable columns={state.outcome.columns} rows={state.outcome.rows} fill />
        </>
      )}

      <Dialog
        open={confirmingDelete}
        title="Excluir proposta"
        onClose={() => setConfirmingDelete(false)}
        describedBy={deleteDescriptionId}
      >
        <p className="mb-6 text-sm" id={deleteDescriptionId}>
          Deseja excluir esta proposta da conversa de forma definitiva?
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)}>
            <span className="flex items-center gap-2">
              <Undo2 size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
              Cancelar
            </span>
          </Button>
          <Button variant="danger" size="sm" onClick={confirmDelete}>
            <span className="flex items-center gap-2">
              <Trash2 size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
              Excluir
            </span>
          </Button>
        </div>
      </Dialog>
    </>
  )
}

export default ArtifactSteps
