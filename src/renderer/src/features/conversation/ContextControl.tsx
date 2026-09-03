import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { AiModel } from '@shared/ipc'
import { CONTEXT_BANDS, fitsInMemory, MIN_NUM_CTX, type ConversationWindow } from '@core/ai/budget'
import Field from '../../shared/ui/Field/Field'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Popover from '../../shared/ui/Popover/Popover'
import { toAnchorName } from '../../shared/ui/Popover/anchorName'
import SegmentedField from '../../shared/ui/SegmentedField/SegmentedField'
import { formatSize } from '../../shared/format'
import { formatContext } from './modelFormat'

// Split out of ModelSelector.tsx once that file crossed the design system's
// line-count ceiling (F2.7) — ModelPicker and ContextControl still read the
// same `models`/`ceilingOf` from ConversationView, but neither reaches into
// the other's internals, so the split costs nothing beyond this import line.

// Replaces the pill label when no window fits at all.
const TOO_BIG = 'max-w-[320px] self-end text-2xs text-warn-text'

/**
 * `CONTEXT_BANDS` below `ceiling`, plus `ceiling` itself as the last option —
 * the machine's real bound, not a round number, same guarantee the old
 * doubling-based ticks gave (F2.5): a ceiling smaller than the first band
 * (RAM varies 3 GB on this machine, D15.13) must still offer something real
 * instead of an empty group.
 */
function bandOptions(ceiling: number): { value: number; label: string }[] {
  const values = [...CONTEXT_BANDS.filter((value) => value < ceiling), ceiling]
  return values.map((value) => ({ value, label: formatContext(value) ?? String(value) }))
}

type ContextBandsProps = {
  initial: number
  ceiling: number
  disabled: boolean
  onCommit: (tokens: number) => void
}

/**
 * Two ways to reach the same domain (21-C-C, "o melhor dos dois mundos"): the
 * seven fixed bands for a quick pick, and a free numeric field for anything
 * else — both write the raw token count, never an index into the bands. A
 * conversation from before this control existed can hold any 1024-multiple
 * (e.g. 12288); the bands simply do not highlight in that case, the same way
 * `ThreadsField` (Settings.tsx) leaves no option marked for a value that
 * predates it — no encaixe forçado, ver F2.5.
 */
function ContextBands({
  initial,
  ceiling,
  disabled,
  onCommit
}: ContextBandsProps): React.JSX.Element {
  const [tokens, setTokens] = useState(initial)
  const [custom, setCustom] = useState(String(initial))

  function commit(value: number): void {
    const clamped = Math.min(ceiling, Math.max(MIN_NUM_CTX, value))
    setTokens(clamped)
    setCustom(String(clamped))
    onCommit(clamped)
  }

  return (
    <div className="flex flex-col gap-3">
      <SegmentedField
        label="Contexto"
        hint={`até ${formatContext(ceiling)}`}
        options={bandOptions(ceiling)}
        value={tokens}
        onChange={commit}
        disabled={disabled}
      />
      <Field label="Personalizado" hint={`múltiplo de ${MIN_NUM_CTX.toLocaleString('pt-BR')}`}>
        <input
          type="number"
          min={MIN_NUM_CTX}
          max={ceiling}
          step={MIN_NUM_CTX}
          disabled={disabled}
          value={custom}
          className="w-full rounded-md border border-border bg-surface-sunken px-4 py-3 font-ui text-sm text-text select-text focus-visible:border-accent-text focus-visible:outline-none"
          onChange={(event) => setCustom(event.target.value)}
          onBlur={() => {
            const parsed = Number(custom)
            if (!Number.isFinite(parsed)) {
              setCustom(String(tokens))
              return
            }
            commit(Math.round(parsed / MIN_NUM_CTX) * MIN_NUM_CTX)
          }}
        />
      </Field>
    </div>
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
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span>{label}</span>
          <ChevronDown size={ICON_SIZE.md} strokeWidth={ICON_STROKE} />
        </button>
      </Field>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorName={anchorName}
        // Wide enough for seven band buttons to wrap over two/three rows
        // (21-C-C) — widened once already (300px) for the old slider's tick
        // labels, kept at 360px here for the same reason.
        className="flex w-[360px] flex-col gap-1"
      >
        {/* No window at all: offering the control here is what produced "até 0k"
              and a clamp to zero, which the IPC schema then rejected (D15.2). */}
        {current !== undefined && contextWindow.status === 'too-large' && (
          <p className={`mt-2 px-2 ${TOO_BIG}`} role="alert">
            Não cabe na memória livre: {formatSize(current.sizeBytes)} de pesos, mais o cache. Feche
            aplicativos e recarregue
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
            {/* Remounted on scope/value change, same reason the old control was
                  re-keyed rather than made controlled from `useState(stored)`:
                  that would copy the value on the first render, before the
                  conversation read returns (fase 14). */}
            <ContextBands
              key={`${scopeKey}:${contextWindow.numCtx}`}
              initial={contextWindow.numCtx}
              ceiling={ceiling}
              disabled={disabled}
              onCommit={onNumCtx}
            />
          </div>
        )}
      </Popover>
    </>
  )
}

export default ContextControl
