import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Cloud, HardDrive } from 'lucide-react'
import type { AiModel } from '@shared/ipc'
import { fitsInMemory, type Budget } from '@core/ai/budget'
import Field from '../../shared/ui/Field/Field'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Popover from '../../shared/ui/Popover/Popover'
import { toAnchorName } from '../../shared/ui/Popover/anchorName'
import StateView from '../../shared/ui/StateView'
import type { ViewState } from '../../shared/ui/state'
import CapabilityChip from './CapabilityChip'
import { capabilityChips } from './capabilities'
import { formatContext, formatSize } from './modelFormat'

// ModelPicker (this file) and ContextControl (own file, F2.7) replaced a
// single popover that mixed model choice with context-window admin (DS5.6,
// item 9). ConversationView composes the two (plus the reload icon) inside
// the SAME render-prop Composer already calls (DS4.8) — the prop's type
// never changes.

// Still-locked, via N-1-C (Gemini + cota) — same disabled shape AttachButton's
// "Código" item uses. GLM left this list in N-1-B, when it became a real option.
const CLOUD_PLACEHOLDERS = ['Gemini']

const GROUP_LABEL =
  'flex items-center gap-2 px-4 text-2xs font-semibold tracking-[0.04em] text-text-faint uppercase'

type ModelPickerProps = {
  state: ViewState<AiModel[]>
  /** The GLM catalog (N-1-B) — a pinned table (Peça C), so this rarely differs from a single-entry ready list. */
  cloudModels: AiModel[]
  /** Whether a GLM key is stored (Peça 9) — gates the click, never the row's visibility. */
  cloudReady: boolean
  /** The same hint `ai:isAvailable` returns, shown when `cloudReady` is false. */
  cloudHint: string | undefined
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
  cloudModels,
  cloudReady,
  cloudHint,
  selected,
  disabled,
  locked,
  onSelect,
  ceilingOf
}: ModelPickerProps): React.JSX.Element {
  // Local catalog only — `selected` already carries the right name whichever
  // catalog it belongs to, so the trigger label never needed a lookup here.
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

  // No early return on `state.status !== 'ready'` here any more (N-1-B):
  // that used to blank the WHOLE picker, trigger included — which meant a
  // downed Ollama also hid the GLM row it sits beside. The trigger and the
  // Nuvem section render unconditionally now; only the Locais section falls
  // back to StateView, scoped to the catalog that is actually not ready.
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
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : openMenu())}
        >
          <span className="min-w-[0px] overflow-hidden text-ellipsis whitespace-nowrap">
            {selected ?? 'Selecionar modelo'}
          </span>
          <ChevronDown size={ICON_SIZE.md} strokeWidth={ICON_STROKE} />
        </button>
      </Field>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorName={anchorName}
        className="flex w-[300px] flex-col gap-1"
      >
        <p className={GROUP_LABEL}>
          <HardDrive size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
          Locais
        </p>
        {state.status !== 'ready' ? (
          <StateView state={state} emptyMessage="Nenhum modelo instalado." render={() => null} />
        ) : (
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
            {/* Two lines (F2.2): name alone on top; size, the machine's real
                  ceiling ("memória" — the practical limit, not a per-token
                  cost) and capability chips below. Every row, not just the
                  selected one — a scope change from the old single-line
                  `optionLabel` + capabilities shown only for `current`. */}
            {models.map((model, index) => {
              const ceiling = ceilingOf(model)
              const chips = capabilityChips(model)
              return (
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
                  className={`flex cursor-pointer flex-col gap-1 rounded-md border px-4 py-2 ${
                    index === highlighted ? 'border-border-strong bg-surface' : 'border-border'
                  }`}
                >
                  <span className="font-ui text-md text-text">{model.name}</span>
                  <span className="flex flex-wrap items-center gap-2 text-2xs text-text-muted">
                    <span>{formatSize(model.sizeBytes)}</span>
                    {ceiling !== null && <span>até {formatContext(ceiling)}</span>}
                    {!fitsInMemory(ceiling) && <span className="text-warn-text">não cabe</span>}
                    {chips.map((chip) => (
                      <CapabilityChip key={chip.capability} {...chip} />
                    ))}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <div className="my-2 border-t border-border-strong" />
        <p className={GROUP_LABEL}>
          <Cloud size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
          Nuvem (Opt-in)
        </p>
        {/* A real option now (N-1-B) — no size/ceiling row like Locais gets:
              a cloud entry costs no local RAM, and "0 B" would be true data
              read as a wrong signal (DN1B.2). `cloudReady` gates the click,
              never the row itself — the model always shows, same "correção,
              não cortesia" reasoning as the nível-3 refusal in chat(). */}
        {cloudModels.map((model) => (
          <button
            key={model.name}
            type="button"
            disabled={!cloudReady}
            title={cloudReady ? undefined : cloudHint}
            onClick={() => {
              onSelect(model.name)
              setOpen(false)
            }}
            className="flex items-center rounded-md px-4 py-2 text-left font-ui text-md text-text disabled:cursor-not-allowed disabled:text-text-faint"
          >
            {model.name}
          </button>
        ))}
        {/* Still locked, via N-1-C — same shape as AttachButton's "Código" item. */}
        {CLOUD_PLACEHOLDERS.map((name) => (
          <button
            key={name}
            type="button"
            disabled
            className="flex cursor-not-allowed items-center rounded-md px-4 py-2 text-left font-ui text-md text-text-faint"
          >
            {name}
          </button>
        ))}
      </Popover>
    </>
  )
}

type BudgetMeterProps = {
  /**
   * The Composer's own gate (DS4.5/DS4.8, D13.2) — this only displays it, the
   * refusal alert stays in the Composer, always visible.
   */
  budget: Budget | null
}

/** The token-usage meter, its own row element (F-1 fixup, item 4) — no
    longer nested inside the ContextControl popover, since it is information
    worth seeing without a click, not an admin control like the window size. */
function BudgetMeter({ budget }: BudgetMeterProps): React.JSX.Element | null {
  if (budget === null) return null
  return (
    <div className="flex flex-none items-center gap-3">
      <meter
        className="h-[6px] w-[100px]"
        min={0}
        max={1}
        low={0.7}
        high={0.9}
        optimum={0}
        value={Math.min(budget.used, 1)}
        aria-label="Orçamento de contexto"
      />
      <span className="text-2xs whitespace-nowrap text-text-faint tabular-nums">
        ~{budget.estimated.toLocaleString('pt-BR')} de {budget.limit.toLocaleString('pt-BR')} tokens
      </span>
    </div>
  )
}

export { ModelPicker, BudgetMeter }
