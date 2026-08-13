import { useState, type ReactNode } from 'react'
import Button from '../shared/ui/Button/Button'
import styles from './Sidebar.module.css'

// Three regions, not one (D13.1): nav, content, footer — the shape a sidebar
// that is only "the list of conversations" must be restructured into once a
// second thing exists, which this plan already has. `collapsed` stays local:
// it is the only state the chrome owns, and the conversation store should not
// answer for something no conversation knows about.

type SidebarProps = {
  nav?: ReactNode
  content?: ReactNode
  footer?: ReactNode
}

function Sidebar({ nav, content, footer }: SidebarProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const classes = [styles.sidebar, collapsed && styles.collapsed].filter(Boolean).join(' ')

  return (
    <aside className={classes}>
      <div className={styles.chrome}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir a barra lateral' : 'Recolher a barra lateral'}
        >
          <span aria-hidden="true">{collapsed ? '»' : '«'}</span>
        </Button>
      </div>

      {!collapsed && (
        <>
          {nav && <nav className={styles.nav}>{nav}</nav>}
          <div className={styles.content}>{content}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </>
      )}
    </aside>
  )
}

export default Sidebar
