import type { ReactNode } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import Button from '../shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../shared/ui/icon'

// Three regions, not one (D13.1): nav, content, footer — the shape a sidebar
// that is only "the list of conversations" must be restructured into once a
// second thing exists, which this plan already has. `collapsed` is controlled
// from App.tsx since F-3-C: the artifact panel asks for the room (DF3C.2), and
// state the panel has to move cannot live inside the sidebar.

export type SidebarProps = {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  nav?: ReactNode
  content?: ReactNode
  footer?: ReactNode
  /**
   * The collapsed rail's buttons — a render-prop, not a plain node, because
   * `nav`/`content`/`footer` are feature components with no notion of
   * expanding the shell around them (same shape as Composer's
   * `modelSelector`, DS4.8). `app/` still never imports `features/`: App.tsx
   * decides what the rail's buttons DO, this file only where they sit.
   */
  collapsedRail?: (expand: () => void) => ReactNode
}

// The content track is minmax(0, 1fr), never a plain 1fr: 1fr floors at
// min-content, so a long conversation list would stretch the track instead of
// scrolling inside it. Width is the one property collapse toggles, so it stays
// out of BASE — two utilities of the same group resolve by stylesheet order,
// not class order (the DS-1 lesson).
const SIDEBAR_BASE =
  'grid h-full grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden border-r border-border ' +
  'bg-surface transition-[width] duration-(--duration-base) ease-initial'

function Sidebar({
  collapsed,
  onCollapsedChange,
  nav,
  content,
  footer,
  collapsedRail
}: SidebarProps): React.JSX.Element {
  const width = collapsed ? 'w-(--sidebar-width-collapsed)' : 'w-(--sidebar-width)'

  return (
    // Named because it is no longer the only complementary region: the artifact
    // panel (F-3-A) is the second, and two unnamed landmarks are one landmark
    // as far as a screen reader is concerned.
    <aside aria-label="Conversas" className={`${SIDEBAR_BASE} ${width}`}>
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
        {/* PanelLeftOpen/Close, not chevrons (DS-5 fixup, item 5) — the target
            uses the sidebar-panel glyph, and the two icons already differ by
            state (an arrow inside the panel, pointing the direction the click
            takes you), so there is nothing extra to encode by hand. */}
        <Button
          variant="ghost"
          size="sm"
          shape="square"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir a barra lateral' : 'Recolher a barra lateral'}
        >
          {collapsed ? (
            <PanelLeftOpen size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
          ) : (
            <PanelLeftClose size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
          )}
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

      {/* The rail: what used to be a dead 44px column with only the reopen
          toggle. Spans rows 2-4 (nav/content/footer's rows), one column of
          icon buttons — no scrolling region of its own, unlike the expanded
          form, since 4 buttons never overflow 44px of width times a full
          window's height. */}
      {collapsed && collapsedRail && (
        <nav className="row-span-3 row-start-2 flex flex-col items-center gap-2 px-1 pb-4">
          {collapsedRail(() => onCollapsedChange(false))}
        </nav>
      )}
    </aside>
  )
}

export default Sidebar
