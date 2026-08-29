import { useState } from 'react'
import { PANEL_GROUPS, PANELS } from './panels'

// border-l-2 is always present — the accent bar's width, reserved so the label
// does not shift when it becomes the current panel (the ConversationList rule).
const ITEM_BASE =
  'w-full rounded-md border-l-2 px-3 py-1.5 text-left text-sm hover:bg-surface-raised'

function ObservatoryShell(): React.JSX.Element {
  const [activeId, setActiveId] = useState(PANELS[0].id)
  const active = PANELS.find((panel) => panel.id === activeId) ?? PANELS[0]
  const groups = PANEL_GROUPS.filter((group) => PANELS.some((panel) => panel.group === group.id))

  return (
    <div className="flex min-h-0 w-full">
      <nav
        aria-label="Painéis"
        className="w-52 flex-none overflow-y-auto border-r border-border px-2 py-4"
      >
        {groups.map((group) => (
          <div key={group.id} className="mb-4 last:mb-0">
            <h3 className="mb-1 px-3 text-2xs font-semibold tracking-[0.04em] text-text-faint uppercase">
              {group.label}
            </h3>
            <ul className="flex flex-col gap-0.5">
              {PANELS.filter((panel) => panel.group === group.id).map((panel) => {
                const current = panel.id === active.id
                return (
                  <li key={panel.id}>
                    <button
                      type="button"
                      aria-current={current ? 'true' : undefined}
                      className={`${ITEM_BASE} ${
                        current
                          ? 'border-accent-text bg-surface-raised font-semibold text-text'
                          : 'border-transparent text-text-muted'
                      }`}
                      onClick={() => setActiveId(panel.id)}
                    >
                      {panel.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
      {/* Only the current panel is rendered, never a stack toggled by CSS:
          mounting IS executing here, and every panel reads something on mount
          (§ 4.2). */}
      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        <active.Panel />
      </div>
    </div>
  )
}

export default ObservatoryShell
