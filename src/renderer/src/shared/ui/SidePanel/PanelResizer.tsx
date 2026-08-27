import { useRef } from 'react'
import { CLOSE_SLACK, DEFAULT_WIDTH, MIN_WIDTH, maxWidth } from './panelWidth'

// The window splitter of the WAI-ARIA APG: role, aria-value* and the keyboard
// come from the pattern (DF3C.5). Values are in px, not the 0–100 the pattern
// suggests, because px is what this handle actually controls.

const STEP = 16

type PanelResizerProps = {
  /** The panel this handle sizes, for `aria-controls`. */
  panelId: string
  width: number
  /** Writes a width straight to the DOM, bypassing React during the drag (DF3C.6). */
  apply: (px: number) => void
  /** Stores the width React keeps, at the end of a gesture. */
  commit: (px: number) => void
  close: () => void
}

function PanelResizer({
  panelId,
  width,
  apply,
  commit,
  close
}: PanelResizerProps): React.JSX.Element {
  // Measured once, at pointerdown: getBoundingClientRect per pointermove is the
  // classic layout thrash, and the panel's right edge does not move anyway.
  const from = useRef<{ right: number; pointerId: number } | null>(null)

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    const panel = event.currentTarget.parentElement
    if (panel === null) return
    from.current = { right: panel.getBoundingClientRect().right, pointerId: event.pointerId }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    document.body.style.userSelect = 'none'
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    const drag = from.current
    if (drag === null || drag.pointerId !== event.pointerId) return
    apply(drag.right - event.clientX)
  }

  // No releasePointerCapture: the platform releases implicitly on up and on
  // cancel, and calling it for an uncaptured pointer throws.
  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>): void {
    const drag = from.current
    if (drag === null) return
    from.current = null
    document.body.style.userSelect = ''
    const next = drag.right - event.clientX
    if (next < MIN_WIDTH - CLOSE_SLACK) close()
    else commit(next)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    // ArrowLeft moves the separator left, which GROWS a panel anchored right.
    const moved =
      event.key === 'ArrowLeft'
        ? width + STEP
        : event.key === 'ArrowRight'
          ? width - STEP
          : event.key === 'Home'
            ? MIN_WIDTH
            : event.key === 'End'
              ? maxWidth()
              : null

    if (moved !== null) {
      event.preventDefault()
      commit(moved)
      return
    }
    // The pattern's "collapse"; restoring is the clip's job or Ctrl+B's, since
    // a closed panel has no handle to press.
    if (event.key === 'Enter') {
      event.preventDefault()
      close()
    }
  }

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-controls={panelId}
      aria-orientation="vertical"
      aria-label="Redimensionar o painel"
      aria-valuemin={MIN_WIDTH}
      aria-valuenow={Math.round(width)}
      aria-valuemax={maxWidth()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={() => commit(DEFAULT_WIDTH)}
      onKeyDown={onKeyDown}
      // 10px of hit target, the measure react-resizable-panels uses for fine
      // pointers. INSIDE the panel, not straddling its border: the panel clips
      // its overflow, and a handle hanging out of it is dead to the pointer.
      // touch-none keeps the browser from panning instead of dragging.
      className="group absolute top-[0px] left-[0px] z-10 h-full w-[10px] cursor-col-resize touch-none"
    >
      <div
        aria-hidden="true"
        className="mx-auto h-full w-[2px] transition-colors duration-(--duration-fast) ease-initial group-hover:bg-border-strong group-focus-visible:bg-border-strong"
      />
    </div>
  )
}

export default PanelResizer
