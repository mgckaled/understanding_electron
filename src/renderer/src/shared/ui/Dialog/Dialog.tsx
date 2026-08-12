import { useEffect, useId, useRef, type ReactNode } from 'react'
import Button from '../Button/Button'
import styles from './Dialog.module.css'

/*
 * The native <dialog> with showModal(), and no dependency (D13.8) — the same
 * line on which fase 10 refused a contrast library for fifteen lines of
 * arithmetic. showModal() gives the top layer, a focus trap, Esc, focus
 * returned to the trigger, and a stylable ::backdrop, all from the platform.
 *
 * `closedby="any"` makes a click outside close it with no handler of our own.
 * Read from the real Chromium rather than a compatibility table, as the plan
 * asked: Electron 42 ships Chromium 148.0.7778.280, where `closedBy` is in
 * HTMLDialogElement's IDL and reflects the attribute. No manual ::backdrop
 * click handling is needed.
 *
 * It lives in shared/ui/ and not inside a feature — unlike MarkdownMessage,
 * which D11.1 kept in its feature for having a single consumer, this one
 * already has a second consumer named: the overwrite confirmation ESCOPO.md
 * requires before writing over a source file.
 */

type DialogProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

function Dialog({ open, title, onClose, children }: DialogProps): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  // Synchronising a prop to an imperative DOM API is the textbook use of an
  // Effect. The cleanup close() matters: showModal() throws if called on an
  // already-open dialog.
  useEffect(() => {
    const node = ref.current
    if (node === null || !open) return
    node.showModal()
    return () => node.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      // The module carries only what a class cannot reach — ::backdrop, the
      // @starting-style fade, the width the fade's rule targets.
      className={`${styles.dialog} rounded-lg border border-border bg-surface p-0 font-ui text-sm text-text`}
      closedby="any"
      aria-labelledby={titleId}
      // Fires for every way out — Esc, the backdrop, close(). Without it the
      // state would stay `open` after Esc and the trigger would look dead.
      onClose={onClose}
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
        <h2 className="text-md font-semibold" id={titleId}>
          {title}
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
          <span aria-hidden="true">×</span>
        </Button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  )
}

export default Dialog
