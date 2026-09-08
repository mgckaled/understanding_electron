import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useConversations } from '../conversation/conversationsContext'
import { usePanel } from '../panel/panelContext'
import { DocsContext, type DocsComposition } from './docsContext'
import { useDocsSearch } from './useDocsSearch'

function DocsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { activeId } = useConversations()
  const { showing, raise, toggle: toggleRegion, close, release } = usePanel()
  const [composition, setComposition] = useState<DocsComposition | null>(null)
  const { state: searchState, search: runSearch, reset: resetSearch } = useDocsSearch()

  // Stamped rather than cleared on navigation: one that belongs to another
  // transcript stops resolving, and closing the panel keeps the text (D23D.2).
  const current = composition?.conversationId === activeId ? composition : null
  const open = showing === 'docs'

  const toggle = useCallback(
    (trigger: HTMLElement | null) => {
      setComposition((previous) => {
        if (previous?.conversationId === activeId) return previous
        // A composition replaced is a list that no longer describes it: the
        // search is not stamped with a conversation, so without this the new
        // composition would open on the previous one's candidates.
        resetSearch()
        return {
          conversationId: activeId,
          library: '',
          question: '',
          candidateKey: null,
          version: null
        }
      })
      if (open) toggleRegion('docs', trigger)
      else raise('docs', trigger)
    },
    [activeId, open, raise, resetSearch, toggleRegion]
  )

  // Both cleared, not just the key: a version belongs to the library it was
  // picked under, and a new list may not index it (D23E.8).
  const search = useCallback(async (): Promise<void> => {
    const query = composition?.library.trim() ?? ''
    if (query === '') return
    setComposition((previous) =>
      previous === null ? previous : { ...previous, candidateKey: null, version: null }
    )
    await runSearch(query)
  }, [composition?.library, runSearch])

  const selectCandidate = useCallback(
    (key: string) =>
      setComposition((previous) =>
        previous === null ? previous : { ...previous, candidateKey: key, version: null }
      ),
    []
  )

  const setVersion = useCallback(
    (version: string | null) =>
      setComposition((previous) => (previous === null ? previous : { ...previous, version })),
    []
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
    () => ({
      current: open ? current : null,
      setLibrary,
      setQuestion,
      selectCandidate,
      setVersion,
      searchState,
      search,
      resetSearch,
      toggle,
      close
    }),
    [
      open,
      current,
      setLibrary,
      setQuestion,
      selectCandidate,
      setVersion,
      searchState,
      search,
      resetSearch,
      toggle,
      close
    ]
  )

  return <DocsContext value={value}>{children}</DocsContext>
}

export default DocsProvider
