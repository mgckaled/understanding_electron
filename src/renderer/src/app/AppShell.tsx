import type { ReactNode } from 'react'

// The shell knows regions, never content (D13.1). One instance, no domain, so
// it lives in app/ rather than shared/ui/ or features/. The rule that keeps it
// from rotting: app/ never imports from features/ — composition happens in
// App.tsx, so a settings surface or plano-18 block enters without touching a
// line here. The slot is a refusal to fix what goes there, not an extension
// point: `main` as a prop compiles to the same lines as rendering it directly.

type AppShellProps = {
  sidebar: ReactNode
  main: ReactNode
}

// Structural scroll (D13.5): the grid fills the height:100% root and clips its
// own overflow, so no child can push the document taller than the window —
// scrolling becomes a decision each region makes, not a side effect. The min
// width on the main column lets a wide child (a code block, a table) scroll
// inside it instead of stretching the grid track past the window.
// `min-w-[0px]`, not `min-w-0`: this project turns off Tailwind's --spacing
// base, so the numeric form emits nothing (measured); the arbitrary value does.
function AppShell({ sidebar, main }: AppShellProps): React.JSX.Element {
  return (
    <div className="grid h-full grid-cols-[auto_minmax(0,1fr)] overflow-hidden bg-bg">
      {sidebar}
      <main className="flex h-full min-w-[0px] flex-col overflow-hidden">{main}</main>
    </div>
  )
}

export default AppShell
