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

/**
 * A thinned subset for the LABELS only — the slider's reachable values never
 * change. Doublings are not evenly spaced on a linear token axis (1024→2048
 * is 3% of a 32768 ceiling; 16384→32768 is 50%), so the low end collides at
 * any width a popover can reasonably take (verified live: even 500px+ cannot
 * fit three labels inside a 9% span). Keeps first/last always; a mark in
 * between survives only once it clears `minGapPercent` from both.
 */
function thinLabels(
  ticks: SliderTick[],
  min: number,
  max: number,
  minGapPercent = 10
): SliderTick[] {
  if (ticks.length <= 2) return ticks
  const percent = (value: number): number => (max === min ? 0 : ((value - min) / (max - min)) * 100)
  const first = ticks[0]!
  const last = ticks[ticks.length - 1]!
  const lastPercent = percent(last.value)
  const kept: SliderTick[] = [first]
  let previousPercent = percent(first.value)
  for (let index = 1; index < ticks.length - 1; index++) {
    const tick = ticks[index]!
    const p = percent(tick.value)
    if (p - previousPercent >= minGapPercent && lastPercent - p >= minGapPercent) {
      kept.push(tick)
      previousPercent = p
    }
  }
  kept.push(last)
  return kept
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
 *
 * The domain stays the raw token count, exactly like the `<input type="number">`
 * it replaces — never an index into the doublings. A conversation from before
 * this control existed can hold any 1024-multiple (e.g. 12288), and an index
 * domain would seat the thumb at the nearest doubling while the pill still
 * read the true value, then commit that rounded value on a stray blur with no
 * drag at all — the exact defect `ThreadsField` (Settings.tsx) already warns
 * against for a value that predates a control. Advisor review caught this
 * before ship; the crowding it was chasing is a label problem (`thinLabels`),
 * not a granularity one.
 */
function ContextSlider({
  id,
  'aria-describedby': describedBy,
  initial,
  ceiling,
  disabled,
  onCommit
}: ContextSliderProps): React.JSX.Element {
  const ticks = contextTicks(ceiling)
  const labels = thinLabels(ticks, MIN_NUM_CTX, ceiling)
  const [tokens, setTokens] = useState(initial)

  return (
    <Slider
      id={id}
      aria-describedby={describedBy}
      min={MIN_NUM_CTX}
      max={ceiling}
      step={MIN_NUM_CTX}
      value={tokens}
      onChange={setTokens}
      onChangeCommitted={onCommit}
      ticks={labels}
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
            the Ollama reference would need resizing to fit here. Widened again
            past the first pass (300px) on user direction after live QA: more
            room lets `thinLabels` keep more marks instead of dropping them. */}
        <div className="flex w-[360px] flex-col gap-1">
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
