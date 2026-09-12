import { createContext, useContext } from 'react'
import type { Budget } from '@core/ai/budget'
import type { ContextOutcome, DocsPart, LibraryCandidate, SearchOutcome } from '@shared/ipc'
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
  /**
   * The second paid call.
   *
   * @param refresh - Skips the session memo and spends a call; the default
   *   returns the answer already paid for, free (D23I.11).
   */
  fetchDocs: (options?: { refresh?: boolean }) => Promise<void>
  /** Drops the answer alone, which is the third screen's way back (D23F.3). */
  resetFetch: () => void
  /** The picked candidate, or `null` while the search has no list to pick from. */
  selected: LibraryCandidate | null
  /**
   * What a consultation costs the next send, exactly — the API counts each
   * snippet itself, so this never goes through `charsPerToken` (D23G.2). It is
   * the live selection while composing and the frozen part once attached, so
   * closing the panel does not stop an attached consultation from counting.
   */
  docsTokens: number
  /** The panel publishing its live selection; the Composer never reads this directly. */
  setSelectedTokens: (value: number) => void
  /**
   * The consultation frozen by `Anexar` and waiting for the next message
   * (D23G.7) — one at a time, because `docsPartOf` finds one per turn.
   */
  pending: DocsPart | null
  attach: (part: DocsPart) => void
  /** Called after the send: the consultation lives in the transcript now (D23G.8). */
  clearPending: () => void
  /**
   * A consultation already in the transcript, reopened for reading (D23H.5) —
   * it wins over composing, which is what makes the transcript's `⧉` and the
   * header counter reach content rather than an empty form.
   */
  viewing: DocsPart | null
  /**
   * Shows one attached consultation in the panel.
   *
   * @param trigger - Where focus returns on close (DF3A.8); `null` for nothing.
   */
  view: (part: DocsPart, trigger: HTMLElement | null) => void
  /** Back to composing, without closing the panel. */
  stopViewing: () => void
  /**
   * The app's single budget, computed by the Composer and handed back here
   * (D23G.1) — the panel's footer and the composer's meter are two numbers on
   * screen at once, and a second `budgetFor` would be free to disagree.
   */
  budget: Budget | null
  reportBudget: (value: Budget | null) => void
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
