import { useState, type SyntheticEvent } from 'react'
import Button from '../../shared/ui/Button/Button'
import styles from './Composer.module.css'

/*
 * Fixed at the bottom of the conversation, never inside the scrolling list.
 *
 * The draft is local for now. It is client state (D13.2), and it stays client
 * state for good — what plano 14 may change is keying it by conversation, so
 * switching away and back does not hand the text to the wrong transcript.
 */

type ComposerProps = {
  disabled: boolean
  loading: boolean
  onSend: (text: string) => void
  onCancel: () => void
}

function Composer({ disabled, loading, onSend, onCancel }: ComposerProps): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const canSend = !disabled && !loading && draft.trim() !== ''

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
