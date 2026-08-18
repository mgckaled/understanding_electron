import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { AiModel } from '@shared/ipc'
import { fitsInMemory, MIN_NUM_CTX, type ConversationWindow } from '@core/ai/budget'
import Field from '../../shared/ui/Field/Field'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Popover from '../../shared/ui/Popover/Popover'
import { toAnchorName } from '../../shared/ui/Popover/anchorName'
import Slider, { type SliderTick } from '../../shared/ui/Slider/Slider'
import { formatContext, formatSize } from './modelFormat'

// Split out of ModelSelector.tsx once that file crossed the design system's
// line-count ceiling (F2.7) — ModelPicker and ContextControl still read the
// same `models`/`ceilingOf` from ConversationView, but neither reaches into
// the other's internals, so the split costs nothing beyond this import line.

// Replaces the pill label when no window fits at all.
const TOO_BIG = 'max-w-[320px] self-end text-2xs text-warn-text'

/**
 * Doublings of `MIN_NUM_CTX` up to `ceiling`, plus `ceiling` itself as the
 * last mark — the machine's real bound, not a round number (F2.5): the fleet
 * varies 32768–131072, never the 256k of the Ollama settings screen this
 * control borrows its shape (not its scale) from.
 */
function contextTicks(ceiling: number): SliderTick[] {
  const values: number[] = []
  for (let value = MIN_NUM_CTX; value < ceiling; value *= 2) {
    values.push(value)
  }
  values.push(ceiling)
  return values.map((value) => ({ value, label: formatContext(value) ?? String(value) }))
}

type ContextSliderProps = {
  id?: string
  'aria-describedby'?: string
  initial: number
  ceiling: number
  disabled: boolean
  onCommit: (tokens: number) => void
}

/**
 * The live thumb position lives here, separate from `onCommit` (F2.5): a drag
 * crosses many `step` boundaries, and firing `onCommit` — which persists via
 * IPC (D14.x) — on every one would spam the write the old `onBlur` input
 * avoided for the same reason. `onChangeCommitted` (mouseup/keyup/blur) is the
 * one call that reaches it.
 */
function ContextSlider({
  id,
  'aria-describedby': describedBy,
  initial,
  ceiling,
  disabled,
  onCommit
}: ContextSliderProps): React.JSX.Element {
  const [value, setValue] = useState(initial)

  return (
    <Slider
      id={id}
      aria-describedby={describedBy}
      min={MIN_NUM_CTX}
      max={ceiling}
      step={MIN_NUM_CTX}
      value={value}
      onChange={setValue}
      onChangeCommitted={onCommit}
      ticks={contextTicks(ceiling)}
      disabled={disabled}
    />
  )
}

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
}

/** The context-window pill: ceiling/reservation and the refusal states. */
function ContextControl({
  contextWindow,
  current,
  ceiling,
  disabled,
  locked,
  scopeKey,
  onNumCtx
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
        {/* Wider than the other three branches need (240px) — the slider's tick
            labels (F2.5) are what asks for it; the rascunho itself flagged that
            the Ollama reference would need resizing to fit here. */}
        <div className="flex w-[300px] flex-col gap-1">
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
                {/* Remounted on scope/value change, same reason the old input was
                    re-keyed rather than made controlled from `useState(stored)`:
                    that would copy the value on the first render, before the
                    conversation read returns (fase 14). */}
                <ContextSlider
                  key={`${scopeKey}:${contextWindow.numCtx}`}
                  initial={contextWindow.numCtx}
                  ceiling={ceiling}
                  disabled={disabled}
                  onCommit={onNumCtx}
                />
              </Field>
            </div>
          )}
        </div>
      </Popover>
    </>
  )
}

export default ContextControl
