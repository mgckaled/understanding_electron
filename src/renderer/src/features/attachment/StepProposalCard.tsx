import { useId, useState } from 'react'
import { tableFromIPC } from 'apache-arrow'
import { Trash2, Undo2 } from 'lucide-react'
import type { ColumnProfile, Step, StepProposalPart } from '@shared/ipc'
import { describeStep } from '@core/pipeline/describe'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Button from '../../shared/ui/Button/Button'
import Dialog from '../../shared/ui/Dialog/Dialog'
import { errorMessage } from '../../shared/ui/messages'
import { useActiveConversation, useConversations } from '../conversation/conversationsContext'
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

// Two different destructive actions share one confirm dialog: editing which
// steps will run (removeStep, ephemeral, client-side) vs. discarding the
// whole card from the conversation for good (deleteCard, persisted —
// live-testing round of arco 19 found the first alone did not satisfy "sem
// volta" — the card itself has to leave, not just shrink to empty).
type PendingAction = { kind: 'removeStep'; index: number } | { kind: 'deleteCard' }

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
 *
 * @param messageId - Identity of the message carrying `part`, needed only to
 *   delete the whole card from the conversation (D19.7-5's confirm dialog).
 */
function StepProposalCard({
  part,
  messageId
}: {
  part: StepProposalPart
  messageId: string
}): React.JSX.Element {
  const conversation = useActiveConversation()
  const { removeMessage } = useConversations()
  const [steps, setSteps] = useState<Step[]>(part.steps)
  const [state, setState] = useState<ApplyState>({ status: 'idle' })
  const [pending, setPending] = useState<PendingAction | null>(null)
  const confirmDescriptionId = useId()

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

  function confirmPending(): void {
    if (pending === null) return
    if (pending.kind === 'removeStep') {
      removeStep(pending.index)
    } else if (conversation !== null) {
      // Persisted (conversation:removeMessage) — a reload must not bring the
      // card back, unlike removeStep's local-only edit above.
      removeMessage(conversation.id, messageId)
    }
    setPending(null)
  }

  const jumps = state.status === 'ready' ? nullJumps(state.result.before, state.result.after) : []

  return (
    <div className="flex max-w-[80%] flex-col gap-3 rounded-lg border border-border bg-surface-raised px-5 py-4 text-text">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-text-muted">Proposta de passos</span>
        {/* Always present, independent of how many steps remain (even zero) —
            this is the whole-card discard, distinct from a per-step edit. */}
        <Button
          variant="outline"
          size="sm"
          shape="circle"
          onClick={() => setPending({ kind: 'deleteCard' })}
          aria-label="Excluir proposta"
        >
          <Trash2 className="text-danger-text" size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
        </Button>
      </div>
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
                onClick={() => setPending({ kind: 'removeStep', index })}
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
        open={pending !== null}
        title={pending?.kind === 'deleteCard' ? 'Excluir proposta' : 'Remover passo'}
        onClose={() => setPending(null)}
        describedBy={confirmDescriptionId}
      >
        <p className="mb-6 text-sm" id={confirmDescriptionId}>
          {pending?.kind === 'deleteCard'
            ? 'Deseja excluir esta proposta da conversa de forma definitiva?'
            : 'Deseja remover o passo de forma definitiva?'}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setPending(null)}>
            <span className="flex items-center gap-2">
              <Undo2 size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
              Cancelar
            </span>
          </Button>
          <Button variant="danger" size="sm" onClick={confirmPending}>
            <span className="flex items-center gap-2">
              <Trash2 size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
              {pending?.kind === 'deleteCard' ? 'Excluir' : 'Remover'}
            </span>
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

export default StepProposalCard
