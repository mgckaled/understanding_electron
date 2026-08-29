import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import Button from '../Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../icon'
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
  /** Id of an element (typically the caller's own intro paragraph) that
   *  describes the dialog's purpose beyond its title. */
  describedBy?: string
  /** `wide` is the observatory's shape: a nav column beside a scrolling
   *  panel, which is why it also drops the padded single scroller (DO1.9). */
  size?: 'default' | 'wide'
  children: ReactNode
}

function Dialog({
  open,
  title,
  onClose,
  describedBy,
  size = 'default',
  children
}: DialogProps): React.JSX.Element {
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
      // @starting-style fade, the width/max-height the fade's rule targets,
      // and display (must stay [open]-scoped, see Dialog.module.css).
      className={`${styles.dialog} ${size === 'wide' ? styles.wide : ''} rounded-lg border border-border bg-surface p-0 font-ui text-sm text-text`}
      closedby="any"
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      // Fires for every way out — Esc, the backdrop, close(). Without it the
      // state would stay `open` after Esc and the trigger would look dead.
      onClose={onClose}
      // `cancel` and `close` do not bubble, but the keydown behind them does —
      // and an ancestor listening for Esc (SidePanel) would act on the same
      // press, closing itself along with the dialog.
      onKeyDown={(event) => {
        if (event.key === 'Escape') event.stopPropagation()
      }}
    >
      <div className="flex flex-none items-center justify-between gap-4 border-b border-border px-6 py-5">
        <h2 className="text-md font-semibold" id={titleId}>
          {title}
        </h2>
        <Button variant="ghost" size="sm" shape="square" onClick={onClose} aria-label="Fechar">
          <X size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
        </Button>
      </div>
      {/* flex-1 + overflow-y-auto is what keeps the header fixed and lets only
          long content scroll, capped by the module's own max-height. A wide
          dialog hands that scrolling to its own columns instead. */}
      <div className={size === 'wide' ? 'flex min-h-0 flex-1' : 'flex-1 overflow-y-auto p-6'}>
        {children}
      </div>
    </dialog>
  )
}

export default Dialog
