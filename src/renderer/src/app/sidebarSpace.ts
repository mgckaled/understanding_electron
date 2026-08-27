import { useCallback, useRef, useState } from 'react'

// 264 + 352 + 416: the sidebar, the panel's 22rem floor and the 26rem the
// thread reserves. Below this the three regions do not fit (DF3C.3).
export const THREE_REGIONS_MIN_WIDTH = 1032

export function fitsThreeRegions(viewportWidth: number): boolean {
  return viewportWidth >= THREE_REGIONS_MIN_WIDTH
}

type SidebarSpace = {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  /** Collapses the sidebar when the artifact panel opens without room (DF3C.3). */
  makeRoom: () => void
}

/** Owns whether the sidebar is collapsed, and the one case where the shell decides it. */
export function useSidebarSpace(): SidebarSpace {
  const [collapsed, setCollapsedState] = useState(false)
  const overridden = useRef(false)

  const setCollapsed = useCallback((next: boolean) => {
    // Expanding by hand turns the rule off for the session.
    if (!next) overridden.current = true
    setCollapsedState(next)
  }, [])

  const makeRoom = useCallback(() => {
    if (overridden.current || fitsThreeRegions(window.innerWidth)) return
    setCollapsedState(true)
  }, [])

  return { collapsed, setCollapsed, makeRoom }
}
