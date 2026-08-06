import type { ReactNode } from 'react'
import styles from './Panel.module.css'

type PanelProps = {
  title?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

function Panel({ title, actions, children, className }: PanelProps): React.JSX.Element {
  const classes = [styles.panel, className].filter(Boolean).join(' ')

  return (
    <section className={classes}>
      {(title || actions) && (
        <header className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      <div className={styles.body}>{children}</div>
    </section>
  )
}

export default Panel
