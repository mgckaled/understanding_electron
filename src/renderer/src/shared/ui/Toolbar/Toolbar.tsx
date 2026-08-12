import type { ReactNode } from 'react'

type ToolbarProps = {
  children: ReactNode
  className?: string
}

function Toolbar({ children, className }: ToolbarProps): React.JSX.Element {
  const classes = ['flex items-center gap-4', className].filter(Boolean).join(' ')

  return <div className={classes}>{children}</div>
}

export default Toolbar
