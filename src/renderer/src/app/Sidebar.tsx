import { useState, type ReactNode } from 'react'
import Button from '../shared/ui/Button/Button'
import styles from './Sidebar.module.css'

/*
 * Three regions, not one (D13.1). Nav on top, content in the middle, footer at
 * the bottom — the shape both reference apps landed on, and the shape a sidebar
 * that is only "the list of conversations" has to be restructured into the day
 * a second thing exists. The second thing is already in this plan.
 *
 * `collapsed` stays local. It is client state that never becomes server cache,
 * but it is also the only state the chrome owns, and putting it in the
 * conversation store would make the store answer for something no conversation
 * knows about. Plano 14 persists the width, and reads the same token.
 */

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
