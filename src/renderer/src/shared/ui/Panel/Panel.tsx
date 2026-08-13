import type { ReactNode } from 'react'

type PanelProps = {
  title?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

// Skip Panel inside the sidebar, or any region the shell already gives a surface:
// the sidebar's own --color-surface draws the boundary, so a Panel there is a
// border inside a border (OpenDatasetPanel uses a plain <section> for this).
function Panel({ title, actions, children, className }: PanelProps): React.JSX.Element {
  const classes = ['rounded-lg border border-border bg-surface', className]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={classes}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
          {title && <h2 className="text-sm font-semibold text-text">{title}</h2>}
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </header>
      )}
      <div className="p-6">{children}</div>
    </section>
  )
}

export default Panel
