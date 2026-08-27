/** The clamp's floor, 22rem in px — the drag and the keyboard need it as a number. */
export const MIN_WIDTH = 352

/** Where the panel opens, 34rem in px (DF3A.4). */
export const DEFAULT_WIDTH = 544

// Dragging this far past the floor closes the panel instead of fighting it
// (DF3C.7). Wide enough not to fire on a shaky hand.
export const CLOSE_SLACK = 40

// The ceiling asked for is 50% of the window; the layout term below can only
// lower it, and the clamp is what enforces both (DF3C.4).
export function maxWidth(): number {
  return Math.round(window.innerWidth / 2)
}

// A value, not a class: it comes from state, and Tailwind's static scan cannot
// see a runtime number — the framework's own docs send complex sizing to
// `style`. It subtracts the sidebar's LIVE width because measuring against the
// window over-promised: at 900px the thread was left with 248px, measured live.
export const WIDTH_CSS =
  'clamp(22rem, var(--artifact-width), min(50vw, 100vw - var(--sidebar-width-now, var(--sidebar-width)) - 26rem))'
