import { createContext, useContext } from 'react'

/** Who can occupy the side region. One at a time, by construction (DE1B.1). */
export type PanelKind = 'artifact' | 'draft'

export type PanelApi = {
  /** Which tenant is on screen, or `null` when the region is closed. */
  showing: PanelKind | null
  /** True while the region fades out and is still mounted (DF3C.1). */
  closing: boolean
  /** The visible tenant's own width in px; each keeps its own (DE1B.3). */
  width: number
  setWidth: (px: number) => void
  /**
   * Hands the region to `kind`, cancelling a pending close.
   *
   * @param trigger - The element that opened it, so focus can return there on
   *   close (DF3A.8). `null` when nothing should be focused back.
   */
  raise: (kind: PanelKind, trigger: HTMLElement | null) => void
  /** Raises `kind`, or closes the region when it is already the one showing. */
  toggle: (kind: PanelKind, trigger: HTMLElement | null) => void
  close: () => void
  /**
   * Gives the region up at once, with no fade and without returning focus —
   * navigation is not a close, and the trigger left with the old transcript.
   */
  release: () => void
  /**
   * Registers what a tenant's shortcut should open — the panel owns the single
   * keydown listener, since two of them racing to `preventDefault` is a defect
   * waiting to happen (DE1B.5).
   */
  onShortcut: (kind: PanelKind, open: () => void) => void
}

export const PanelContext = createContext<PanelApi | null>(null)

export function usePanel(): PanelApi {
  const value = useContext(PanelContext)
  if (value === null) {
    throw new Error('usePanel must be called inside <PanelProvider>.')
  }
  return value
}
