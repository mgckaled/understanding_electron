import { createContext, useContext } from 'react'
import type { ContextOutcome, LibraryCandidate, SearchOutcome } from '@shared/ipc'
import type { ViewState } from '../../shared/ui/state'

/** A consultation being composed, stamped with the conversation it follows (D23D.2). */
export type DocsComposition = {
  conversationId: string | null
  library: string
  question: string
  /** The picked candidate's synthetic key; `id` repeats within one response (D23A.5). */
  candidateKey: string | null
  /** `null` is the library's own default — "most recent" is not computable (D23A.6). */
  version: string | null
}

export type DocsApi = {
  /** What is being composed, or `null` when the region shows something else. */
  current: DocsComposition | null
  setLibrary: (value: string) => void
  setQuestion: (value: string) => void
  selectCandidate: (key: string) => void
  setVersion: (value: string | null) => void
  /**
   * The paid search, held here and not in the panel: the candidate list is part
   * of the composition, and closing the panel must not lose it (D23E.3).
   */
  searchState: ViewState<SearchOutcome>
  search: () => Promise<void>
  resetSearch: () => void
  /** The second paid call, held beside the search for the same reason (D23E.3). */
  fetchState: ViewState<ContextOutcome>
  fetchDocs: () => Promise<void>
  /** Drops the answer alone, which is the third screen's way back (D23F.3). */
  resetFetch: () => void
  /** The picked candidate, or `null` while the search has no list to pick from. */
  selected: LibraryCandidate | null
  /**
   * Shows the panel, or closes it when it is already the one open.
   *
   * @param trigger - Where focus returns on close (DF3A.8); `null` for nothing.
   */
  toggle: (trigger: HTMLElement | null) => void
  close: () => void
}

export const DocsContext = createContext<DocsApi | null>(null)

export function useDocs(): DocsApi {
  const value = useContext(DocsContext)
  if (value === null) {
    throw new Error('useDocs must be called inside <DocsProvider>.')
  }
  return value
}
