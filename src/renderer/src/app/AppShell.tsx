import type { ReactNode } from 'react'

// The shell knows regions, never content (D13.1). One instance, no domain, so
// it lives in app/ rather than shared/ui/ or features/. The rule that keeps it
// from rotting: app/ never imports from features/ — composition happens in
// App.tsx, so a settings surface or plano-18 block enters without touching a
// line here. The slot is a refusal to fix what goes there, not an extension
// point: `main` as a prop compiles to the same lines as rendering it directly.

type AppShellProps = {
  sidebar: ReactNode
  /** Publishes the sidebar's live width to the whole grid (DF3C.4). */
  sidebarCollapsed: boolean
  main: ReactNode
  /**
   * The right-hand region (plano F-3-A), shared by its tenants (DE1B.1).
   * Renders raw, unlike `main`: only a panel knows whether it is open, so it
   * brings its own `<aside>` or nothing — a wrapper here would draw an empty
   * region with a border every time it is closed. The shell owns the track; it
   * just does not own the element.
   */
  panel?: ReactNode
}

// Structural scroll (D13.5): the grid fills the height:100% root and clips its
// own overflow, so no child can push the document taller than the window —
// scrolling becomes a decision each region makes, not a side effect. The min
// width on the main column lets a wide child (a code block, a table) scroll
// inside it instead of stretching the grid track past the window.
// `min-w-[0px]`, not `min-w-0`: this project turns off Tailwind's --spacing
// base, so the numeric form emits nothing (measured); the arbitrary value does.
// The third track is `auto`, so the shell never learns the panel's width — the
// panel sizes itself (DF3A.4), and a closed one collapses the track to zero.
function AppShell({
  sidebar,
  sidebarCollapsed,
  main,
  panel
}: AppShellProps): React.JSX.Element {
  return (
    // --sidebar-width-now is set here and nowhere else: the sidebar's own width
    // and the panel's ceiling both read it, so they cannot disagree (DF3C.4).
    <div
      className="grid h-full grid-cols-[auto_minmax(0,1fr)_auto] overflow-hidden bg-bg"
      style={
        {
          '--sidebar-width-now': sidebarCollapsed
            ? 'var(--sidebar-width-collapsed)'
            : 'var(--sidebar-width)'
        } as React.CSSProperties
      }
    >
      {sidebar}
      <main className="flex h-full min-w-[0px] flex-col overflow-hidden">{main}</main>
      {panel}
    </div>
  )
}

export default AppShell
