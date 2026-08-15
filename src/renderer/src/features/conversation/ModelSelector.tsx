import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, RefreshCw } from 'lucide-react'
import type { AiModel } from '@shared/ipc'
import { fitsInMemory, MIN_NUM_CTX, type Budget, type ConversationWindow } from '@core/ai/budget'
import Field from '../../shared/ui/Field/Field'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Popover from '../../shared/ui/Popover/Popover'
import { toAnchorName } from '../../shared/ui/Popover/anchorName'
import StateView from '../../shared/ui/StateView'
import type { ViewState } from '../../shared/ui/state'

// The selector that replaced a free-text <input> defaulting to `gemma3:4b`
// (D15.1/D15.2): a typo used to produce a generic upstream error, and nothing
// knew which model can see. Chrome density — in the header, scanned not read.

// Replaces the context control when no window fits; used from two states.
const TOO_BIG = 'max-w-[320px] self-end text-2xs text-warn-text'

// Capabilities the app has a word for; everything else renders under its raw
// name, keeping the `string[]` promise alive on screen (`insert` arrived
// unpredicted). `completion` is on every model, says nothing, and is dropped.
const CAPABILITY_LABEL: Record<string, string> = {
  vision: 'imagem',
  tools: 'ferramentas',
  embedding: 'embeddings'
}

function badges(model: AiModel): string[] {
  return model.capabilities
    .filter((capability) => capability !== 'completion')
    .map((capability) => CAPABILITY_LABEL[capability] ?? capability)
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`
}

/**
 * 131072 → "128k", 32768 → "32k". Binary thousands — what the number is and how
 * model cards write it; the order of magnitude is the decision, not the digits.
 */
function formatContext(tokens: number | null): string | null {
  return tokens === null ? null : `${Math.round(tokens / 1024)}k`
}

// Marked, not disabled: free RAM is a snapshot of a machine the user is also
// using, and closing a browser changes the answer (D15.2).
function optionLabel(model: AiModel, ceiling: number | null): string {
  const context = formatContext(model.contextLength)
  const fits = fitsInMemory(ceiling)
  return [model.name, formatSize(model.sizeBytes), context, fits ? '' : 'não cabe']
    .filter(Boolean)
    .join(' · ')
}

type ModelSelectorProps = {
  state: ViewState<AiModel[]>
  /** Already resolved: the conversation's model, or the first installed one. */
  selected: string | null
  disabled: boolean
  /** The pair closed on this conversation's first send (D15.13). */
  locked: boolean
  onSelect: (name: string) => void
  onReload: () => void
  /** The window in force, and whether it can be changed or even used. */
  contextWindow: ConversationWindow
  /**
   * `min(trained ceiling, what this machine can hold)`, for any model in the
   * list. A function, not one number for the selection, because the list needs
   * it too — and passing the rule keeps it defined in ONE place with its margin.
   */
  ceilingOf: (model: AiModel) => number | null
  /** Identity of the conversation, so the window control re-reads on switch. */
  scopeKey: string
  onNumCtx: (tokens: number) => void
  /**
   * The Composer's own gate (DS4.5, D13.2) — this popover only displays it,
   * the refusal alert stays in the Composer, always visible.
   */
  budget: Budget | null
}

function ModelSelector({
  state,
  selected,
  disabled,
  locked,
  onSelect,
  onReload,
  contextWindow,
  ceilingOf,
  scopeKey,
  onNumCtx,
  budget
}: ModelSelectorProps): React.JSX.Element {
  const current = state.status === 'ready' ? state.data.find((m) => m.name === selected) : undefined
  const ceiling = current === undefined ? null : ceilingOf(current)
  const fits = fitsInMemory(ceiling)
  const models = state.status === 'ready' ? state.data : []

  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const anchorName = toAnchorName(useId())
  const listboxId = useId()
  const listboxRef = useRef<HTMLDivElement>(null)

  // Moves focus to the list so arrow keys work without an extra Tab — the same
  // reason Dialog focuses on open, just via a ref instead of the platform.
  useEffect(() => {
    if (open) listboxRef.current?.focus()
  }, [open])

  const openMenu = (): void => {
    const index = models.findIndex((model) => model.name === selected)
    setHighlighted(index === -1 ? 0 : index)
    setOpen(true)
  }

  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((index) => Math.min(index + 1, models.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const model = models[highlighted]
      if (model !== undefined) {
        onSelect(model.name)
        setOpen(false)
      }
    }
  }

  // Chrome density (D13.6): lives in the composer's controls row, scanned not read.
  return (
    <div className="flex flex-none items-center gap-3">
      {/* Field must wrap the trigger, not the StateView: Field clones its child
          to inject `id` (skill design-system), so a StateView between would take
          the id and the button would get none, leaving <label for> pointing at
          nothing. So Field appears only when there IS a control — a <button> is
          labelable, so <label htmlFor> still resolves correctly onto it. */}
      {state.status === 'ready' ? (
        <Field label="Modelo">
          <button
            type="button"
            className="flex max-w-[280px] cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-sunken px-4 py-2 font-ui text-xs text-text disabled:cursor-not-allowed disabled:text-text-faint"
            style={{ anchorName }}
            disabled={disabled || locked}
            aria-haspopup="listbox"
            onClick={() => (open ? setOpen(false) : openMenu())}
          >
            <span className="min-w-[0px] overflow-hidden text-ellipsis whitespace-nowrap">
              {current?.name ?? selected ?? 'Selecionar modelo'}
            </span>
            <ChevronDown size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
          </button>
        </Field>
      ) : (
        <StateView
          state={state}
          emptyMessage="Nenhum modelo instalado."
          // Never called: `ready` is handled above. StateView is here for the
          // other four states, which is the half of it that carries the
          // loading bar and the error registry.
          render={() => null}
        />
      )}

      <button
        type="button"
        className="cursor-pointer self-end rounded-md border border-border bg-transparent px-3 py-2 text-xs leading-none text-text-muted hover:text-text"
        onClick={onReload}
        // Installing a model is a system event with no notification, so the
        // catalog can only be wrong in one direction — stale. The button is the
        // whole answer to that, which is why it is always available.
        title="Recarregar a lista de modelos"
        aria-label="Recarregar a lista de modelos"
      >
        <RefreshCw size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
      </button>

      {state.status === 'ready' && (
        <Popover open={open} onClose={() => setOpen(false)} anchorName={anchorName}>
          {/* The layout class lives on THIS inner div, never on Popover's own root
            (its `display` would beat the UA stylesheet's `[popover]:not(:popover-open)`
            hide rule — see Popover.tsx). */}
          <div className="flex w-[280px] flex-col gap-1">
            <div
              ref={listboxRef}
              role="listbox"
              id={listboxId}
              aria-label="Modelo"
              tabIndex={0}
              onKeyDown={onListKeyDown}
              aria-activedescendant={
                models[highlighted] !== undefined ? `${listboxId}-option-${highlighted}` : undefined
              }
              className="flex flex-col gap-1 focus-visible:outline-none"
            >
              {models.map((model, index) => (
                <div
                  key={model.name}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={model.name === selected}
                  onClick={() => {
                    onSelect(model.name)
                    setOpen(false)
                  }}
                  onMouseEnter={() => setHighlighted(index)}
                  className={`cursor-pointer rounded-md px-4 py-2 font-ui text-xs text-text ${
                    index === highlighted ? 'bg-surface-raised' : ''
                  }`}
                >
                  {optionLabel(model, ceilingOf(model))}
                </div>
              ))}
            </div>

            {/* Migrated from Composer (DS4.5) — the gate itself (budgetFor,
              canSend) stays there; this is presentation only. */}
            {budget !== null && (
              <div className="mt-2 flex items-center gap-3 border-t border-border px-2 pt-2">
                <meter
                  className="h-[6px] w-[120px]"
                  min={0}
                  max={1}
                  low={0.7}
                  high={0.9}
                  optimum={0}
                  value={Math.min(budget.used, 1)}
                  aria-label="Orçamento de contexto"
                />
                <span className="text-2xs text-text-faint tabular-nums">
                  ~{budget.estimated.toLocaleString('pt-BR')} de{' '}
                  {budget.limit.toLocaleString('pt-BR')} tokens
                </span>
              </div>
            )}

            {/* No window at all: offering the control here is what produced "até 0k"
              and a clamp to zero, which the IPC schema then rejected (D15.2). */}
            {current !== undefined && contextWindow.status === 'too-large' && (
              <p className={`mt-2 ${TOO_BIG}`} role="alert">
                Não cabe na memória livre: {formatSize(current.sizeBytes)} de pesos, mais o cache.
                Feche aplicativos e recarregue
                {locked ? ', ou comece uma conversa nova.' : ', ou escolha um modelo menor.'}
              </p>
            )}

            {/* The lock's asymmetric second failure mode: the reservation is remade on
              every load and free RAM varies by 3 GB here, so refusing is the point —
              shrinking in silence would undo the lock's guarantee (D15.13). */}
            {contextWindow.status === 'unaffordable' && (
              <p className={`mt-2 ${TOO_BIG}`} role="alert">
                Esta conversa reservou {contextWindow.numCtx.toLocaleString('pt-BR')} tokens, e a
                memória livre agora não comporta. Feche aplicativos e recarregue.
              </p>
            )}

            {contextWindow.status === 'locked' && (
              // A stated number, not a control (D15.13).
              <p className="mt-2 px-2 text-xs whitespace-nowrap text-text-muted">
                Contexto: {contextWindow.numCtx.toLocaleString('pt-BR')} tokens · travado
              </p>
            )}

            {contextWindow.status === 'open' && fits && ceiling !== null && (
              <div className="mt-2 px-2">
                <Field label="Contexto" hint={`até ${formatContext(ceiling)}`}>
                  {/* Uncontrolled and re-keyed: useState(stored) would copy the value on
                    the first render, before the conversation read returns (fase 14). */}
                  <input
                    key={`${scopeKey}:${contextWindow.numCtx}`}
                    className="w-[88px] rounded-md border border-border bg-surface-sunken px-4 py-2 font-ui text-xs text-text focus-visible:border-accent-text focus-visible:outline-none"
                    type="number"
                    min={MIN_NUM_CTX}
                    max={ceiling}
                    step={MIN_NUM_CTX}
                    defaultValue={contextWindow.numCtx}
                    disabled={disabled}
                    // On blur, not per keystroke — clamping while typing turns a cleared
                    // field into the floor. The floor also keeps 0 off the IPC boundary.
                    onBlur={(event) => {
                      const parsed = Number(event.target.value)
                      if (!Number.isFinite(parsed) || parsed <= 0) return
                      onNumCtx(Math.min(Math.max(Math.round(parsed), MIN_NUM_CTX), ceiling))
                    }}
                  />
                </Field>
              </div>
            )}

            {current !== undefined && badges(current).length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2 px-2">
                {badges(current).map((label) => (
                  // A capability with no label of its own renders under its raw name,
                  // so this stays legible for text nobody chose (`insert` was first).
                  <li
                    key={label}
                    className="rounded-sm border border-border bg-surface-raised px-3 py-1 text-2xs whitespace-nowrap text-text-muted"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Popover>
      )}
    </div>
  )
}

export default ModelSelector
