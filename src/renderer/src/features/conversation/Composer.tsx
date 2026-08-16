import { useState, type ReactNode, type SyntheticEvent } from 'react'
import { ArrowUp, Pause } from 'lucide-react'
import type { DatasetPart } from '@shared/ipc'
import { budgetFor, type Budget } from '@core/ai/budget'
import { formatDataCard } from '@core/ai/dataCard'
import Button from '../../shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import AttachButton from '../attachment/AttachButton'

// Fixed at the bottom of the conversation, never inside the scrolling list. The
// draft is local client state (D13.2) and stays that way; what plano 14 may add
// is keying it by conversation so switching does not hand text to the wrong one.

type ComposerProps = {
  disabled: boolean
  loading: boolean
  /**
   * Whether the pair `(model, num_ctx)` has closed (D15.13). It changes the
   * GATE'S ADVICE only: two of the three ways out (raise the window, switch to a
   * bigger ceiling) stop existing once locked, and advice the app will not
   * honour is the same defect as none.
   */
  locked: boolean
  /** `attachment` is the pending dataset, cleared together with the draft right after (D16.6). */
  onSend: (text: string, attachment: DatasetPart | null) => void
  onCancel: () => void
  /**
   * Everything already in the transcript, in characters. The budget is computed
   * HERE, not by the view, because the draft lives here — and the draft is half
   * of what the next send costs, so a gate ignoring it would pass the overflow.
   */
  historyChars: number
  /** The reserved window, or null when it cannot be known yet. */
  limit: number | null
  charsPerToken: number
  /**
   * The model selector, moved out of the removed top toolbar and into the
   * composer's controls row (DS-3 passo 7). A render-prop, not a plain node
   * (DS4.8): `budget` is computed HERE (below), but the popover that displays
   * it is defined in ConversationView, which has no `draft` to compute it from.
   */
  modelSelector: (budget: Budget | null) => ReactNode
}

function Composer({
  disabled,
  loading,
  locked,
  onSend,
  onCancel,
  historyChars,
  limit,
  charsPerToken,
  modelSelector
}: ComposerProps): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState<DatasetPart | null>(null)

  // A PENDING attachment is about to be sent just as much as the draft text is
  // — counted here with the same materializer toChatMessages uses (D16.5), so
  // a card that will not fit is caught before the send, not after.
  const attachmentChars = attachment === null ? 0 : formatDataCard(attachment).length
  const budget =
    limit === null
      ? null
      : budgetFor({
          historyChars,
          draftChars: draft.length + attachmentChars,
          limit,
          charsPerToken
        })

  // The gate (D15.5): nothing is truncated in silence — when the next turn will
  // not fit, the send is refused with the reason on screen, instead of the
  // provider dropping the beginning and answering confidently about the rest.
  const overflows = budget !== null && !budget.fits
  const canSend = !disabled && !loading && draft.trim() !== '' && !overflows

  const submit = (event: SyntheticEvent): void => {
    event.preventDefault()
    if (!canSend) return
    onSend(draft, attachment)
    setDraft('')
    setAttachment(null)
  }

  // Enter sends, Shift+Enter breaks the line. Beyond the letter of the plan,
  // but a composer where Enter does nothing is a defect found in the first
  // minute — and a textarea's default is a newline, so it has to be written.
  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) submit(event)
  }

  // Chrome density (D13.6): the composer's controls are chrome, but the draft
  // is read at the reading size, matching the answer — and it is the user's own
  // text, so select-text opts back into selection base.css turns off at the root.
  return (
    <form
      className="flex flex-none flex-col gap-3 border-t border-border bg-bg px-7 pt-5 pb-6"
      onSubmit={submit}
    >
      {/* One rounded container holds the textarea and the controls row — the
          DS-3 composer shape. focus-within lifts the border to accent, replacing
          the per-control ring the textarea used to carry on its own border. */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-5 py-4 focus-within:border-accent-text">
        {/* field-sizing:content grows the box with what is typed — Chromium-only,
            fine here since the app only ever runs on the embedded Chromium — so
            no onInput/scrollHeight math is needed; min/max in `lh` bound it to
            1..3 lines and overflow-y-auto takes over once the 4th line arrives. */}
        <textarea
          className="w-full resize-none bg-transparent font-ui text-reading leading-normal select-text focus-visible:outline-none [field-sizing:content] min-h-[1lh] max-h-[3lh] overflow-y-auto"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder="Pergunte algo ao modelo…"
          aria-label="Mensagem"
        />
        {/* Left to right (F-1 fixup, item 4): clip · model pill · reload ·
            context counter — pause + circular send stay on the right (DS-3
            passo 8). gap-6, not gap-3 (item 3): distinct items get more air;
            each item's own label stays close to its control via Field's own
            gap-2, untouched. The selector keeps its refusal alerts — nothing
            from plano 15 is collapsed away. */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-[0px] flex-wrap items-center gap-5">
            <AttachButton
              attachment={attachment}
              onAttached={setAttachment}
              onRemove={() => setAttachment(null)}
              disabled={disabled}
            />
            {modelSelector(budget)}
          </div>
          <div className="flex flex-none items-center gap-2">
            {loading && (
              <Button
                variant="secondary"
                shape="circle"
                size="lg"
                type="button"
                onClick={onCancel}
                aria-label="Cancelar"
              >
                <Pause size={ICON_SIZE.md} strokeWidth={ICON_STROKE} />
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              shape="circle"
              size="lg"
              loading={loading}
              disabled={!canSend}
              aria-label="Enviar"
            >
              <ArrowUp size={ICON_SIZE.md} strokeWidth={ICON_STROKE} />
            </Button>
          </div>
        </div>
      </div>
      {/* The meter used to sit here (D15.4) — it moved into the model popover
          (DS4.5). The refusal below did NOT move: D15.5 wants it visible before
          the overflow happens, and a popover the user has not opened is not that. */}
      {overflows && budget !== null && (
        <p
          className="rounded-md border border-warn-text bg-surface-sunken px-4 py-3 text-xs text-warn-text"
          role="alert"
        >
          {budget.messageAloneOverflows ? (
            <>
              Esta mensagem sozinha não cabe na janela de contexto.{' '}
              {locked ? (
                <>
                  Encurte a mensagem, ou comece uma conversa nova com uma janela maior — esta está
                  travada em {budget.limit.toLocaleString('pt-BR')} tokens.
                </>
              ) : (
                <>
                  Começar uma conversa nova <strong>não resolve</strong> — encurte a mensagem,
                  aumente o contexto ou troque para um modelo de teto maior.
                </>
              )}
            </>
          ) : (
            <>
              O histórico já não cabe na janela de contexto.{' '}
              {locked
                ? 'Esta conversa está travada no modelo e na janela do primeiro envio, então a saída é começar uma conversa nova.'
                : 'Aumente o contexto, troque para um modelo de teto maior, ou comece uma conversa nova.'}
            </>
          )}
        </p>
      )}
    </form>
  )
}

export default Composer
