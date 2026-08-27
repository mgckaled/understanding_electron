import { useId, useRef } from 'react'

// The APG tabs pattern, with activation following focus: arrowing to a tab
// shows it. The alternative (Enter to activate) exists for panels that are
// expensive to open, and these are cached queries (DF3D.1).
//
// Second caller arrived with the draft panel (DE1C.4), so it moved here.

const STRIP = 'flex flex-none gap-1 border-b border-border px-5'

const TAB =
  'cursor-pointer border-b-2 px-3 py-2 font-ui text-sm ' +
  'transition-colors duration-(--duration-fast) ease-initial'

const ACTIVE = `${TAB} border-accent-text font-semibold text-text`
const IDLE = `${TAB} border-transparent text-text-muted hover:text-text`

export type TabDefinition = {
  id: string
  label: string
  render: () => React.ReactNode
}

/**
 * A tab strip and the panel it shows.
 *
 * @param label - Names the tablist itself, which has no visible heading.
 * @param keepMounted - Renders every panel and hides the inactive ones, for a
 *   body that cannot survive unmounting — a CodeMirror history dies with its
 *   view (DE1C.4). Off by default: a mounted panel keeps working, and the
 *   dataset's Consulta tab talks to the engine.
 */
function Tabs({
  tabs,
  active,
  onChange,
  label,
  keepMounted = false
}: {
  tabs: TabDefinition[]
  active: string
  onChange: (id: string) => void
  label: string
  keepMounted?: boolean
}): React.JSX.Element {
  const base = useId()
  const strip = useRef<HTMLDivElement>(null)
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0]

  const tabId = (id: string): string => `${base}-tab-${id}`
  const panelId = (id: string): string => `${base}-panel-${id}`

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const at = tabs.findIndex((tab) => tab.id === current.id)
    const target =
      event.key === 'ArrowRight'
        ? (at + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (at - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : null

    if (target === null) return
    event.preventDefault()
    onChange(tabs[target].id)
    // By position, not by id lookup: the strip's children ARE the tabs, in
    // order, and `useId` values need escaping to survive a selector.
    const moved = strip.current?.children[target]
    if (moved instanceof HTMLElement) moved.focus()
  }

  return (
    <>
      <div className={STRIP} role="tablist" aria-label={label} onKeyDown={onKeyDown} ref={strip}>
        {tabs.map((tab) => {
          const selected = tab.id === current.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              aria-selected={selected}
              aria-controls={panelId(tab.id)}
              // Roving tabindex: one stop for the whole strip, then arrows.
              tabIndex={selected ? 0 : -1}
              className={selected ? ACTIVE : IDLE}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      {(keepMounted ? tabs : [current]).map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={panelId(tab.id)}
          aria-labelledby={tabId(tab.id)}
          tabIndex={0}
          hidden={tab.id !== current.id}
          className="flex min-h-[0px] flex-1 flex-col outline-none"
        >
          {tab.render()}
        </div>
      ))}
    </>
  )
}

export default Tabs
