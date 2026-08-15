import { useEffect, useRef, type ReactNode } from 'react'
import styles from './Popover.module.css'

// Native `[popover]` + CSS anchor positioning, control fully imperative (DS4.4):
// no click-outside listener, no position:fixed measured by hand.

// ⚠️ No `className` prop, on purpose: an author `display` class on this root
// (even Tailwind's `flex`) beats the UA stylesheet's hide-when-closed rule
// regardless of specificity. Consumers wrap their content in their own inner
// `<div className="flex …">` instead — see HISTORY.md § um className no Popover.

type PopoverProps = {
  open: boolean
  onClose: () => void
  /** From `toAnchorName(useId())` in the consumer, matching the trigger's own
   *  `style={{ anchorName }}` — Popover only knows the panel side of the pair. */
  anchorName: string
  children: ReactNode
}

function Popover({ open, onClose, anchorName, children }: PopoverProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  // Synchronising a prop to an imperative DOM API — same shape as Dialog's own
  // effect. The `matches` guards make each call safe to repeat: showPopover()
  // throws if already shown, hidePopover() is a no-op if already hidden.
  useEffect(() => {
    const node = ref.current
    if (node === null) return
    if (open && !node.matches(':popover-open')) node.showPopover()
    if (!open && node.matches(':popover-open')) node.hidePopover()
  }, [open])

  // Browser-initiated closes (light-dismiss, Esc) never call onClose on their
  // own — this is the only path back to React state, mirroring Dialog's native
  // `onClose` on the `close` event.
  useEffect(() => {
    const node = ref.current
    if (node === null) return
    const onToggle = (event: Event): void => {
      if ((event as ToggleEvent).newState === 'closed') onClose()
    }
    node.addEventListener('toggle', onToggle)
    return () => node.removeEventListener('toggle', onToggle)
  }, [onClose])

  return (
    <div
      ref={ref}
      popover="auto"
      className={`${styles.popover} rounded-lg border border-border-strong bg-surface-raised p-2 font-ui text-sm text-text`}
      style={{ positionAnchor: anchorName }}
    >
      {children}
    </div>
  )
}

export default Popover
