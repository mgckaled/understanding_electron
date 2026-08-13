import type { ReactNode } from 'react'
import styles from './AppShell.module.css'

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

function AppShell({ sidebar, main }: AppShellProps): React.JSX.Element {
  return (
    <div className={styles.shell}>
      {sidebar}
      <main className={styles.main}>{main}</main>
    </div>
  )
}

export default AppShell
