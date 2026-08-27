import { useEffect, useId, useRef, type ReactNode } from 'react'
import styles from './SidePanel.module.css'
import PanelResizer from './PanelResizer'
import { WIDTH_CSS } from './panelWidth'

type SidePanelProps = {
  /** Names the region, which has no visible heading of its own. */
  label: string
  /** What the region shows now — a change moves focus back into the panel (DF3A.8). */
  contentKey: string
  /** True while the panel fades out and is still mounted (DF3C.1). */
  closing: boolean
  width: number
  setWidth: (px: number) => void
  onClose: () => void
  header: ReactNode
  children: ReactNode
}

function SidePanel({
  label,
  contentKey,
  closing,
  width,
  setWidth,
  onClose,
  header,
  children
}: SidePanelProps): React.JSX.Element {
  const panelId = useId()
  const region = useRef<HTMLElement>(null)

  // Without this, keyboard navigation opens the panel and lands nowhere; the
  // caller's close sends focus back to the trigger (DF3A.8).
  useEffect(() => {
    region.current?.focus()
  }, [contentKey])

  return (
    <aside
      id={panelId}
      ref={region}
      // Not a Dialog and not a focus trap: the panel is NOT modal — clicking
      // back into the conversation with it open has to keep working. So Esc
      // only closes while focus is inside it, which is the platform's own
      // behaviour for a non-modal region.
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
      className={`${styles.panel} relative flex h-full flex-col overflow-hidden border-l border-border bg-surface outline-none`}
      data-closing={closing ? 'true' : undefined}
      style={{ '--panel-width': `${width}px`, width: WIDTH_CSS } as React.CSSProperties}
      aria-label={label}
    >
      <PanelResizer
        panelId={panelId}
        width={width}
        apply={(px) => region.current?.style.setProperty('--panel-width', `${px}px`)}
        commit={setWidth}
        close={onClose}
      />
      {/* Chrome density (D13.6): the region is navigation and identity, not reading. */}
      <header className="flex flex-none items-center gap-3 border-b border-border px-5 py-4">
        {header}
      </header>

      {/* Not a scrolling surface: which part of a body scrolls depends on the
          body, and the body decides it. */}
      <div className="flex min-h-[0px] flex-1 flex-col p-1">{children}</div>
    </aside>
  )
}

export default SidePanel
