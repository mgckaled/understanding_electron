import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Budget } from '@core/ai/budget'
import type { DocsPart } from '@shared/ipc'
import { useConversations } from '../conversation/conversationsContext'
import { usePanel } from '../panel/panelContext'
import { DocsContext, type DocsComposition } from './docsContext'
import { useDocsFetch } from './useDocsFetch'
import { useDocsSearch } from './useDocsSearch'

/**
 * Whether two budgets say the same thing. `budgetFor` builds a fresh object on
 * every render, so storing it unguarded would set state on every pass and never
 * settle — the loop D23G.1 warns about.
 */
function sameBudget(a: Budget | null, b: Budget | null): boolean {
  if (a === null || b === null) return a === b
  return (
    a.estimated === b.estimated &&
    a.limit === b.limit &&
    a.fits === b.fits &&
    a.messageAloneOverflows === b.messageAloneOverflows
  )
}

function DocsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { activeId } = useConversations()
  const { showing, raise, toggle: toggleRegion, close, release } = usePanel()
  const [composition, setComposition] = useState<DocsComposition | null>(null)
  const { state: searchState, search: runSearch, reset: resetSearch } = useDocsSearch()
  const { state: fetchState, fetch: runFetch, reset: resetFetch } = useDocsFetch()
  const [selectedTokens, setSelectedTokens] = useState(0)
  const [budget, setBudget] = useState<Budget | null>(null)
  // Stamped like the composition (D23D.2): switching conversations must not
  // carry a consultation composed for another transcript into this one.
  const [attached, setAttached] = useState<{
    conversationId: string | null
    part: DocsPart
  } | null>(null)
  // Stamped for the same reason as the two above: a consultation belongs to the
  // transcript it was attached to, and navigating away must not leave another
  // conversation's answer on screen.
  const [viewed, setViewed] = useState<{
    conversationId: string | null
    part: DocsPart
  } | null>(null)

  const reportBudget = useCallback((next: Budget | null) => {
    setBudget((previous) => (sameBudget(previous, next) ? previous : next))
  }, [])

  // Stamped rather than cleared on navigation: one that belongs to another
  // transcript stops resolving, and closing the panel keeps the text (D23D.2).
  const current = composition?.conversationId === activeId ? composition : null
  const open = showing === 'docs'

  // Derived here and not in the screen, because the call needs the same
  // candidate the radio shows — two fallbacks would be free to diverge. The
  // first stands in for a key left over from an earlier list (D23A.4).
  const candidates =
    searchState.status === 'ready' && searchState.data.status === 'found'
      ? searchState.data.candidates
      : []
  const selected =
    candidates.find((one) => one.key === current?.candidateKey) ?? candidates[0] ?? null

  const toggle = useCallback(
    (trigger: HTMLElement | null) => {
      setComposition((previous) => {
        if (previous?.conversationId === activeId) return previous
        // A composition replaced is a list that no longer describes it: the
        // search is not stamped with a conversation, so without this the new
        // composition would open on the previous one's candidates.
        resetSearch()
        resetFetch()
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
    [activeId, open, raise, resetFetch, resetSearch, toggleRegion]
  )

  // Both cleared, not just the key: a version belongs to the library it was
  // picked under, and a new list may not index it (D23E.8).
  const search = useCallback(async (): Promise<void> => {
    const query = composition?.library.trim() ?? ''
    if (query === '') return
    setComposition((previous) =>
      previous === null ? previous : { ...previous, candidateKey: null, version: null }
    )
    resetFetch()
    await runSearch(query)
  }, [composition?.library, resetFetch, runSearch])

  // The result belongs to the library it was fetched for: keeping it across a
  // change of candidate would show one library's snippets under another's name.
  const selectCandidate = useCallback(
    (key: string) => {
      setComposition((previous) =>
        previous === null ? previous : { ...previous, candidateKey: key, version: null }
      )
      resetFetch()
    },
    [resetFetch]
  )

  const setVersion = useCallback(
    (version: string | null) =>
      setComposition((previous) => (previous === null ? previous : { ...previous, version })),
    []
  )

  // `version` is left out of the payload when absent rather than sent empty:
  // the schema is `min(1)`, so a blank string would be a bug, not a default.
  const fetchDocs = useCallback(async (): Promise<void> => {
    if (selected === null || current === null) return
    await runFetch({
      libraryId: selected.id,
      query: current.question,
      ...(current.version === null ? {} : { version: current.version })
    })
  }, [current, runFetch, selected])

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

  const viewing = viewed?.conversationId === activeId ? viewed.part : null

  // Raises the region as well as choosing the content: the two entry points
  // (the transcript line and the header counter) both live outside the panel,
  // so neither can assume it is already open.
  const view = useCallback(
    (part: DocsPart, trigger: HTMLElement | null) => {
      setViewed({ conversationId: activeId, part })
      if (!open) raise('docs', trigger)
    },
    [activeId, open, raise]
  )

  const stopViewing = useCallback(() => setViewed(null), [])

  // Released, not closed: navigation is not a close (DE1B.1). A consultation
  // opened for reading holds the region on its own — the counter reaches it
  // without any composition existing.
  useEffect(() => {
    if (open && current === null && viewing === null) release()
  }, [open, current, viewing, release])

  const pending = attached?.conversationId === activeId ? attached.part : null

  // The frozen part once attached, the live selection while composing — never
  // both, because attaching freezes the selection (D23G.7). Without this the
  // meter would drop an attached consultation the moment the panel closed.
  const docsTokens =
    pending === null
      ? selectedTokens
      : [...pending.snippets, ...pending.notes].reduce((sum, one) => sum + one.tokens, 0)

  const attach = useCallback(
    (part: DocsPart) => setAttached({ conversationId: activeId, part }),
    [activeId]
  )

  // The consultation is in the transcript now, so the panel goes back to an
  // empty form (D23G.8) — the way back to a sent one is the 23-H history.
  const clearPending = useCallback(() => {
    setAttached(null)
    resetSearch()
    resetFetch()
    setComposition((previous) =>
      previous === null
        ? previous
        : { ...previous, library: '', question: '', candidateKey: null, version: null }
    )
  }, [resetFetch, resetSearch])

  // Going back to the form drops both: the list is what the form produced, and
  // the result is what the list produced.
  const backToCompose = useCallback(() => {
    resetSearch()
    resetFetch()
  }, [resetFetch, resetSearch])

  const value = useMemo(
    () => ({
      current: open ? current : null,
      setLibrary,
      setQuestion,
      selectCandidate,
      setVersion,
      searchState,
      search,
      resetSearch: backToCompose,
      fetchState,
      fetchDocs,
      resetFetch,
      selected,
      docsTokens,
      setSelectedTokens,
      pending,
      attach,
      clearPending,
      viewing,
      view,
      stopViewing,
      budget,
      reportBudget,
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
      backToCompose,
      fetchState,
      fetchDocs,
      resetFetch,
      selected,
      docsTokens,
      pending,
      attach,
      clearPending,
      viewing,
      view,
      stopViewing,
      budget,
      reportBudget,
      toggle,
      close
    ]
  )

  return <DocsContext value={value}>{children}</DocsContext>
}

export default DocsProvider
