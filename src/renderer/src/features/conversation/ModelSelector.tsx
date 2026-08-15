import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { AiModel } from '@shared/ipc'
import { fitsInMemory, MIN_NUM_CTX, type Budget, type ConversationWindow } from '@core/ai/budget'
import Field from '../../shared/ui/Field/Field'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Popover from '../../shared/ui/Popover/Popover'
import { toAnchorName } from '../../shared/ui/Popover/anchorName'
import StateView from '../../shared/ui/StateView'
import type { ViewState } from '../../shared/ui/state'

// Two pills, not one (DS5.6, item 9): `ModelPicker` (this file) and
// `ContextControl` (below) replaced a single popover that mixed model choice
// with context-window admin. Split by CONCERN, not by file — both read the
// same `models`/`ceilingOf`, so keeping them in one module avoids threading
// that state through a barrel export. ConversationView composes the two (plus
// the reload icon) inside the SAME render-prop Composer already calls
// (DS4.8) — the prop's type never changes.

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

type ModelPickerProps = {
  state: ViewState<AiModel[]>
  /** Already resolved: the conversation's model, or the first installed one. */
  selected: string | null
  disabled: boolean
  /** The pair closed on this conversation's first send (D15.13). */
  locked: boolean
  onSelect: (name: string) => void
  /**
   * `min(trained ceiling, what this machine can hold)`, for any model in the
   * list. A function, not one number for the selection, because the list needs
   * it too — and passing the rule keeps it defined in ONE place with its margin.
   */
  ceilingOf: (model: AiModel) => number | null
}

/** The model name pill: trigger, listbox, and the selected model's capability badges. */
function ModelPicker({
  state,
  selected,
  disabled,
  locked,
  onSelect,
  ceilingOf
}: ModelPickerProps): React.JSX.Element {
  const current = state.status === 'ready' ? state.data.find((m) => m.name === selected) : undefined
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

  if (state.status !== 'ready') {
    return (
      <StateView
        state={state}
        emptyMessage="Nenhum modelo instalado."
        // Never called: `ready` returns below. StateView is here for the other
        // four states, which is the half of it that carries the loading bar
        // and the error registry.
        render={() => null}
      />
    )
  }

  return (
    <>
      {/* Field must wrap the trigger, not the StateView: Field clones its child
          to inject `id` (skill design-system), so a StateView between would take
          the id and the button would get none, leaving <label for> pointing at
          nothing. A <button> is labelable, so <label htmlFor> still resolves. */}
      <Field label="Modelo" inline>
        <button
          type="button"
          className="flex h-(--control-height-md) max-w-[200px] cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-sunken px-5 font-ui text-sm text-text disabled:cursor-not-allowed disabled:text-text-faint"
          style={{ anchorName }}
          disabled={disabled || locked}
          aria-haspopup="listbox"
          onClick={() => (open ? setOpen(false) : openMenu())}
        >
          <span className="min-w-[0px] overflow-hidden text-ellipsis whitespace-nowrap">
            {current?.name ?? selected ?? 'Selecionar modelo'}
          </span>
          <ChevronDown size={ICON_SIZE.md} strokeWidth={ICON_STROKE} />
        </button>
      </Field>
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
                className={`cursor-pointer rounded-md px-4 py-2 font-ui text-md text-text ${
                  index === highlighted ? 'bg-surface-raised' : ''
                }`}
              >
                {optionLabel(model, ceilingOf(model))}
              </div>
            ))}
          </div>

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
    </>
  )
}

// Replaces the pill label when no window fits at all.
const TOO_BIG = 'max-w-[320px] self-end text-2xs text-warn-text'

type ContextControlProps = {
  contextWindow: ConversationWindow
  /** The conversation's resolved model, or undefined if none is installed/chosen. */
  current: AiModel | undefined
  /** `ceilingOf(current)` — computed once by the caller, which already has both. */
  ceiling: number | null
  disabled: boolean
  /** The pair closed on this conversation's first send (D15.13). */
  locked: boolean
  /** Identity of the conversation, so the window control re-reads on switch. */
  scopeKey: string
  onNumCtx: (tokens: number) => void
  /**
   * The Composer's own gate (DS4.5/DS4.8, D13.2) — this popover only displays
   * it, the refusal alert stays in the Composer, always visible.
   */
  budget: Budget | null
}

/** The context-window pill: ceiling/reservation, the refusal states, and the budget meter. */
function ContextControl({
  contextWindow,
  current,
  ceiling,
  disabled,
  locked,
  scopeKey,
  onNumCtx,
  budget
}: ContextControlProps): React.JSX.Element {
  const fits = fitsInMemory(ceiling)
  const [open, setOpen] = useState(false)
  const anchorName = toAnchorName(useId())

  const label =
    contextWindow.status === 'too-large' ? '—' : (formatContext(contextWindow.numCtx) ?? '—')

  return (
    <>
      <Field label="Janela de contexto" inline>
        <button
          type="button"
          className="flex h-(--control-height-md) max-w-[120px] cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-sunken px-5 font-ui text-sm text-text disabled:cursor-not-allowed disabled:text-text-faint"
          style={{ anchorName }}
          disabled={disabled}
          aria-haspopup="dialog"
          onClick={() => setOpen((value) => !value)}
        >
          <span>{label}</span>
          <ChevronDown size={ICON_SIZE.md} strokeWidth={ICON_STROKE} />
        </button>
      </Field>
      <Popover open={open} onClose={() => setOpen(false)} anchorName={anchorName}>
        <div className="flex w-[240px] flex-col gap-1">
          {/* Migrated from Composer (DS4.5), then off ModelPicker (DS5.6) — the
              gate itself (budgetFor, canSend) stays in Composer; this is
              presentation only. */}
          {budget !== null && (
            <div className="flex items-center gap-3 px-2 pt-1">
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
            <p className={`mt-2 px-2 ${TOO_BIG}`} role="alert">
              Não cabe na memória livre: {formatSize(current.sizeBytes)} de pesos, mais o cache.
              Feche aplicativos e recarregue
              {locked ? ', ou comece uma conversa nova.' : ', ou escolha um modelo menor.'}
            </p>
          )}

          {/* The lock's asymmetric second failure mode: the reservation is remade on
              every load and free RAM varies by 3 GB here, so refusing is the point —
              shrinking in silence would undo the lock's guarantee (D15.13). */}
          {contextWindow.status === 'unaffordable' && (
            <p className={`mt-2 px-2 ${TOO_BIG}`} role="alert">
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
        </div>
      </Popover>
    </>
  )
}

export { ModelPicker, ContextControl }
