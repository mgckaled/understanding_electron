import type { ReactNode } from 'react'
import styles from './Toolbar.module.css'

type ToolbarProps = {
  children: ReactNode
  className?: string
}

function Toolbar({ children, className }: ToolbarProps): React.JSX.Element {
  const classes = [styles.toolbar, className].filter(Boolean).join(' ')

  return <div className={classes}>{children}</div>
}

export default Toolbar
