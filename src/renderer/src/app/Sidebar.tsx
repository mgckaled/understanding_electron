import { useState, type ReactNode } from 'react'
import Button from '../shared/ui/Button/Button'

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

// The content track is minmax(0, 1fr), never a plain 1fr: 1fr floors at
// min-content, so a long conversation list would stretch the track instead of
// scrolling inside it. Width is the one property collapse toggles, so it stays
// out of BASE — two utilities of the same group resolve by stylesheet order,
// not class order (the DS-1 lesson).
const SIDEBAR_BASE =
  'grid h-full grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden border-r border-border ' +
  'bg-surface transition-[width] duration-(--duration-base) ease-initial'

function Sidebar({ nav, content, footer }: SidebarProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const width = collapsed ? 'w-(--sidebar-width-collapsed)' : 'w-(--sidebar-width)'

  return (
    <aside className={`${SIDEBAR_BASE} ${width}`}>
      {/* Each region is pinned to its own row with row-start-*: without it an
          absent nav would slide content into row 2 and the footer into the
          flexible row, so it stops sitting at the bottom — and the bug shows up
          only in the composition that omits a slot. Header: app title left,
          collapse toggle right. The title drops when collapsed so it never
          overflows the narrow rail; justify-center then keeps the lone toggle
          centred in the 44px column. */}
      <div
        className={`row-start-1 flex items-center p-3 ${collapsed ? 'justify-center' : 'justify-between'}`}
      >
        {!collapsed && <span className="font-ui text-sm font-semibold text-text">Chat local</span>}
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
          {nav && <nav className="row-start-2 flex flex-col gap-2 px-4 pb-4">{nav}</nav>}
          {/* The only region of the sidebar that scrolls. `min-h-[0px]`, not
              min-h-0: --spacing base is off, so the numeric form emits nothing. */}
          <div className="row-start-3 flex min-h-[0px] flex-col gap-5 overflow-y-auto px-4">
            {content}
          </div>
          {footer && (
            <div className="row-start-4 border-t border-border p-4 text-2xs text-text-muted">
              {footer}
            </div>
          )}
        </>
      )}
    </aside>
  )
}

export default Sidebar
