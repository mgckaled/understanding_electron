import { useState, type SyntheticEvent } from 'react'
import { budgetFor } from '@core/ai/budget'
import Button from '../../shared/ui/Button/Button'
import styles from './Composer.module.css'

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
  onSend: (text: string) => void
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
}

function Composer({
  disabled,
  loading,
  locked,
  onSend,
  onCancel,
  historyChars,
  limit,
  charsPerToken
}: ComposerProps): React.JSX.Element {
  const [draft, setDraft] = useState('')

  const budget =
    limit === null
      ? null
      : budgetFor({ historyChars, draftChars: draft.length, limit, charsPerToken })

  // The gate (D15.5): nothing is truncated in silence — when the next turn will
  // not fit, the send is refused with the reason on screen, instead of the
  // provider dropping the beginning and answering confidently about the rest.
  const overflows = budget !== null && !budget.fits
  const canSend = !disabled && !loading && draft.trim() !== '' && !overflows

  const submit = (event: SyntheticEvent): void => {
    event.preventDefault()
    if (!canSend) return
    onSend(draft)
    setDraft('')
  }

  // Enter sends, Shift+Enter breaks the line. Beyond the letter of the plan,
  // but a composer where Enter does nothing is a defect found in the first
  // minute — and a textarea's default is a newline, so it has to be written.
  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) submit(event)
  }

  return (
    <form className={styles.composer} onSubmit={submit}>
      <textarea
        className={styles.textarea}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        rows={3}
        placeholder="Pergunte algo ao modelo…"
        aria-label="Mensagem"
      />
      {budget !== null && (
        <div className={styles.budget}>
          {/* The meter, chrome density and deliberately quiet: it exists so the
              overflow is VISIBLE BEFORE it happens (D15.4) — without it the first
              sign of trouble is a confident answer about half a conversation. */}
          <meter
            className={styles.meter}
            min={0}
            max={1}
            low={0.7}
            high={0.9}
            optimum={0}
            value={Math.min(budget.used, 1)}
            aria-label="Orçamento de contexto"
          />
          <span className={styles.budgetText}>
            ~{budget.estimated.toLocaleString('pt-BR')} de {budget.limit.toLocaleString('pt-BR')}{' '}
            tokens
          </span>
        </div>
      )}

      {overflows && budget !== null && (
        <p className={styles.overflow} role="alert">
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

      <div className={styles.actions}>
        {loading && (
          <Button variant="secondary" type="button" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="primary" loading={loading} disabled={!canSend}>
          Enviar
        </Button>
      </div>
    </form>
  )
}

export default Composer
