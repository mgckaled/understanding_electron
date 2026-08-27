import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Draft } from '@shared/ipc'
import { useConversations } from '../conversation/conversationsContext'
import { usePanel } from '../panel/panelContext'
import { DraftContext } from './draftContext'
import { useDrafts } from './useDrafts'

function DraftProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { activeId } = useConversations()
  const { drafts, hasDraftOf, create, remove } = useDrafts(activeId)
  const { showing, raise, toggle: toggleRegion, close, release, onShortcut } = usePanel()
  const [openId, setOpenId] = useState<string | null>(null)

  // Resolved from the list rather than held as an object, so an edit or a
  // deletion elsewhere reaches the panel without a second copy to keep in step.
  // Deleting the open one falls back to the newest that survived; only an empty
  // list closes the panel (DE1B.7).
  const selected = drafts.find((draft) => draft.id === openId) ?? drafts.at(-1) ?? null
  const current = showing === 'draft' ? selected : null

  const toggle = useCallback(
    (draft: Draft, trigger: HTMLElement | null) => {
      setOpenId(draft.id)
      if (current !== null && current.id === draft.id) toggleRegion('draft', trigger)
      else raise('draft', trigger)
    },
    [current, raise, toggleRegion]
  )

  const togglePanel = useCallback(
    (trigger: HTMLElement | null) => {
      const target = selected ?? drafts[drafts.length - 1]
      if (target !== undefined) toggle(target, trigger)
    },
    [selected, drafts, toggle]
  )

  // Deleting the open one, or switching conversation, empties the selection —
  // the region would otherwise stay marked as ours with nothing in it (DE1B.1).
  useEffect(() => {
    if (showing === 'draft' && selected === null) release()
  }, [showing, selected, release])

  useEffect(() => {
    onShortcut('draft', () => togglePanel(null))
  }, [onShortcut, togglePanel])

  const value = useMemo(
    () => ({
      drafts,
      current,
      hasDraftOf,
      createFrom: create,
      remove,
      toggle,
      togglePanel,
      close
    }),
    [drafts, current, hasDraftOf, create, remove, toggle, togglePanel, close]
  )

  return <DraftContext value={value}>{children}</DraftContext>
}

export default DraftProvider
