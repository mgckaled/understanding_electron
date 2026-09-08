import { createContext, useContext } from 'react'
import type { SearchOutcome } from '@shared/ipc'
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
