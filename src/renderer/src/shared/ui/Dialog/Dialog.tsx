import { useEffect, useId, useRef, type ReactNode } from 'react'
import Button from '../Button/Button'
import styles from './Dialog.module.css'

// The native <dialog> with showModal() and no dependency (D13.8): the platform
// gives the top layer, focus trap, Esc, focus returned to the trigger, and a
// stylable ::backdrop. `closedby="any"` closes on outside click with no handler
// of ours — confirmed in the real Chromium 148 the Electron 42 ships (`closedBy`
// in the IDL). In shared/ui/, not a feature, because it has a second consumer:
// the overwrite confirmation ESCOPO.md requires.

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
