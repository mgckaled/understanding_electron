import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Cloud, HardDrive } from 'lucide-react'
import type { AiModel, AiService } from '@shared/ipc'
import { fitsInMemory, type Budget } from '@core/ai/budget'
import Field from '../../shared/ui/Field/Field'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Popover from '../../shared/ui/Popover/Popover'
import { toAnchorName } from '../../shared/ui/Popover/anchorName'
import StateView from '../../shared/ui/StateView'
import type { ViewState } from '../../shared/ui/state'
import CapabilityChip from '../../shared/ui/CapabilityChip/CapabilityChip'
import { capabilityChips } from './capabilities'
import { formatSize } from '../../shared/format'
import { formatContext, formatRateLimit } from './modelFormat'

// ModelPicker (this file) and ContextControl (own file, F2.7) replaced a
// single popover that mixed model choice with context-window admin (DS5.6,
// item 9). ConversationView composes the two (plus the reload icon) inside
// the SAME render-prop Composer already calls (DS4.8) — the prop's type
// never changes.

const GROUP_LABEL =
  'flex items-center gap-2 px-4 text-2xs font-semibold tracking-[0.04em] text-text-faint uppercase'

// One line per model (DNC-23): name, metadata column, chips.
const ROW = 'flex cursor-pointer items-center gap-3 rounded-md border px-4 py-2'
// ⚠️ `min-w-[0px]`, never `min-w-0`: the project sets `--spacing-*: initial`
// and redeclares only steps 1-9, so every step-0 utility emits no CSS at all,
// and a name with no lower bound pushes the chips out of the row.
//
// The name GROWS, so the chips end flush right and the metadata column slides
// with the chip count. Both shapes were built and looked at side by side; the
// owner chose this one (DN3B.1). A fixed name column aligns the chips' left
// edge instead, at the cost of a ragged right margin.
const ROW_NAME = 'min-w-[0px] flex-1 truncate font-ui text-md'

/**
 * Which row is highlighted, in the one shape both groups share (DNC-29). A
 * discriminated union rather than an index plus a hovered name: the cloud rows
 * are not in the listbox, so two independent states would let the mouse and the
 * arrow keys light up two rows at once. Here that is unexpressable.
 */
type Highlight = { group: 'local'; index: number } | { group: 'cloud'; name: string }

// The colour goes DOWN a step from the Popover's own `surface-raised`, which is
// what the design system asks for where an item already sits on it — and is
// exactly why the cloud rows' old `hover:bg-surface-raised` was invisible: it
// painted the background with the background.
const rowHighlight = (on: boolean): string =>
  on ? 'border-border-strong bg-surface' : 'border-transparent'

/** The row's middle column — every metadata item separated by `·` (DNC-28),
 *  right-aligned inside a fixed width so the chip column lines up. */
function RowMeta({ items }: { items: React.ReactNode[] }): React.JSX.Element {
  return (
    <span className="flex w-[170px] flex-none items-center justify-end gap-2 text-2xs text-text-muted group-disabled:opacity-40">
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && <span aria-hidden="true">·</span>}
          {item}
        </Fragment>
      ))}
    </span>
  )
}

type ModelPickerProps = {
  state: ViewState<AiModel[]>
  /** The pinned cloud catalogs (GLM since N-1-B, Gemini since N-1-C), concatenated by the caller — Peça C, so this rarely changes shape at runtime. */
  cloudModels: AiModel[]
  /** Whether a key is stored per cloud provider (Peça 9) — gates the click, never the row's visibility. Only cloud keys are ever populated; `ollama` is never looked up here. */
  cloudReadyFor: Partial<Record<AiService, boolean>>
  /** The same hint `ai:isAvailable` returns per provider, shown when that provider's `cloudReadyFor` entry is false. */
  cloudHintFor: Partial<Record<AiService, string | undefined>>
  /** Already resolved: the conversation's model, or the first installed one. */
  selected: string | null
  disabled: boolean
  /** The pair closed on this conversation's first send (D15.13). */
  locked: boolean
  onSelect: (name: string) => void
  /**
   * `min(trained ceiling, what this machine can hold)` for Ollama, or the
   * model's own trained window for cloud (N-1-C, DN1C.2) — for any model in
   * the list. A function, not one number for the selection, because the list
   * needs it too — and passing the rule keeps it defined in ONE place with
   * its margin.
   */
  ceilingOf: (model: AiModel) => number | null
}

/** The model name pill: trigger, listbox, and the selected model's capability badges. */
function ModelPicker({
  state,
  cloudModels,
  cloudReadyFor,
  cloudHintFor,
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
  const [highlight, setHighlight] = useState<Highlight>({ group: 'local', index: 0 })
  // -1 while the highlight sits on a cloud row: `models[-1]` is undefined, which
  // both aria-activedescendant and Enter already guard against.
  const localIndex = highlight.group === 'local' ? highlight.index : -1
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
    setHighlight({ group: 'local', index: index === -1 ? 0 : index })
    setOpen(true)
  }

  // An arrow pressed while the mouse highlighted a cloud row comes back to the
  // listbox, which is where the focus was the whole time.
  const moveLocal = (step: number): void =>
    setHighlight((current) => ({
      group: 'local',
      index: Math.max(
        0,
        Math.min((current.group === 'local' ? current.index : -1) + step, models.length - 1)
      )
    }))

  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveLocal(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveLocal(-1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const model = models[localIndex]
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
        // 300px (N-1-C: the Nuvem rows had grown a second line) → 380 → 560,
        // and this time the width follows a change of AXIS instead of standing
        // in for one (DNC-24). `max-w` because the popover is anchored and
        // jsdom does no layout: no level-2 test would fail a popover that ran
        // off a narrow window.
        className="flex w-[560px] max-w-[90vw] flex-col gap-1"
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
              models[localIndex] !== undefined ? `${listboxId}-option-${localIndex}` : undefined
            }
            className="flex flex-col gap-1 focus-visible:outline-none"
          >
            {/* One line (DNC-23): name, then size and the machine's real ceiling
                  ("memória" — the practical limit, not a per-token cost), then
                  the chips. Every row, not just the selected one — a scope
                  change F2.2 made over the old single-line `optionLabel`. */}
            {models.map((model, index) => {
              const ceiling = ceilingOf(model)
              const fits = fitsInMemory(ceiling)
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
                  onMouseEnter={() => setHighlight({ group: 'local', index })}
                  className={`${ROW} text-text ${rowHighlight(index === localIndex)}`}
                >
                  <span className={ROW_NAME}>{model.name}</span>
                  {/* The ceiling only shows while there IS a useful one: a tiny
                      ceiling rounds to "até 0k" beside the verdict (DNC-27). */}
                  <RowMeta
                    items={[
                      formatSize(model.sizeBytes),
                      ...(ceiling !== null && fits ? [`até ${formatContext(ceiling)}`] : []),
                      ...(fits
                        ? []
                        : [
                            <span key="fits" className="text-warn-text">
                              não cabe
                            </span>
                          ])
                    ]}
                  />
                  <span className="flex flex-none items-center gap-1">
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
        {/* A real option since N-1-B — no size/RAM-ceiling row like Locais
              gets: a cloud entry costs no local RAM (DN1B.2). Since N-1-C it
              carries its own second line instead — trained context, the
              documented free-tier limit, capability chips — same visual
              density as Locais, adapted to what a cloud row actually has.
              `cloudReadyFor` gates the click per provider, never the row
              itself — the model always shows, disabled with a reason
              ("no key configured"), rather than hidden ("correção, não
              cortesia"). Colour and `disabled:*` live on the BUTTON, not a
              child span: `disabled:*` compiles to `&:disabled`, which only
              ever matches the element that can actually be disabled. */}
        {cloudModels.map((model) => {
          const ready = cloudReadyFor[model.provider] ?? false
          const chips = capabilityChips(model)
          const rateLimit = model.rateLimit
          // The free-tier limit is administration — nobody picks a model by RPD
          // — so it moves to the hover, WHATEVER its shape (DNC-25, DN3B.3
          // reversed live): splitting by `kind` split one fact into two rules,
          // and left the one concurrency row longer than every line beside it.
          // The key hint wins the `title` whenever the row is disabled: it is
          // the only actionable of the two, and the row already owned that
          // attribute since N-1-B (DN3B.2).
          const limit = rateLimit === undefined ? undefined : formatRateLimit(rateLimit)
          return (
            <button
              key={model.name}
              type="button"
              disabled={!ready}
              title={ready ? limit : cloudHintFor[model.provider]}
              onClick={() => {
                onSelect(model.name)
                setOpen(false)
              }}
              onMouseEnter={() => setHighlight({ group: 'cloud', name: model.name })}
              className={`group ${ROW} text-left text-text disabled:cursor-not-allowed disabled:text-text-faint ${rowHighlight(
                highlight.group === 'cloud' && highlight.name === model.name
              )}`}
            >
              <span className={ROW_NAME}>{model.name}</span>
              {/* `até <n>k` in both groups (DNC-26): "de contexto" was a second
                  grammar for the same fact, one list apart from the first. */}
              <RowMeta
                items={
                  model.contextLength === null ? [] : [`até ${formatContext(model.contextLength)}`]
                }
              />
              {/* CapabilityChip sets its own color/background, so disabled:text-*
                  can't reach it — group-disabled:opacity fades the chips instead. */}
              <span className="flex flex-none items-center gap-1 group-disabled:opacity-40">
                {chips.map((chip) => (
                  <CapabilityChip key={chip.capability} {...chip} />
                ))}
              </span>
            </button>
          )
        })}
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
