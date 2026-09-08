import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useConversations } from '../conversation/conversationsContext'
import { usePanel } from '../panel/panelContext'
import { DocsContext, type DocsComposition } from './docsContext'

function DocsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { activeId } = useConversations()
  const { showing, raise, toggle: toggleRegion, close, release } = usePanel()
  const [composition, setComposition] = useState<DocsComposition | null>(null)

  // Stamped rather than cleared on navigation: one that belongs to another
  // transcript stops resolving, and closing the panel keeps the text (D23D.2).
  const current = composition?.conversationId === activeId ? composition : null
  const open = showing === 'docs'

  const toggle = useCallback(
    (trigger: HTMLElement | null) => {
      setComposition((previous) =>
        previous?.conversationId === activeId
          ? previous
          : { conversationId: activeId, library: '', question: '' }
      )
      if (open) toggleRegion('docs', trigger)
      else raise('docs', trigger)
    },
    [activeId, open, raise, toggleRegion]
  )

  const setLibrary = useCallback(
    (library: string) =>
      setComposition((previous) => (previous === null ? previous : { ...previous, library })),
    []
  )

  const setQuestion = useCallback(
    (question: string) =>
      setComposition((previous) => (previous === null ? previous : { ...previous, question })),
    []
  )

  // Released, not closed: navigation is not a close (DE1B.1).
  useEffect(() => {
    if (open && current === null) release()
  }, [open, current, release])

  const value = useMemo(
    () => ({ current: open ? current : null, setLibrary, setQuestion, toggle, close }),
    [open, current, setLibrary, setQuestion, toggle, close]
  )

  return <DocsContext value={value}>{children}</DocsContext>
}

export default DocsProvider
