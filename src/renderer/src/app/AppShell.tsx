import type { ReactNode } from 'react'
import styles from './AppShell.module.css'

/*
 * The shell knows regions, never content (D13.1). It has exactly one instance
 * and no domain, which is why it lives in app/ rather than in shared/ui/ (one
 * of each reusable primitive) or features/ (one per subject).
 *
 * The rule that keeps this from rotting as the conversational arc lands:
 * app/ never imports from features/. Composition happens in App.tsx, so a
 * reviewable-steps block or a settings surface enters without touching a line
 * here — and the 250-line component budget is never spent on the shell.
 *
 * The slot is NOT an extension point: `main` as a prop compiles to the same
 * number of lines as rendering <ConversationView/> directly. It is the refusal
 * to fix what goes there, in the sense docs/HISTORY.md draws between the two.
 */

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
