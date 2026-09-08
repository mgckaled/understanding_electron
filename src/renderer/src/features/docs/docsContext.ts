import { createContext, useContext } from 'react'

/** A consultation being composed, stamped with the conversation it follows (D23D.2). */
export type DocsComposition = {
  conversationId: string | null
  library: string
  question: string
}

export type DocsApi = {
  /** What is being composed, or `null` when the region shows something else. */
  current: DocsComposition | null
  setLibrary: (value: string) => void
  setQuestion: (value: string) => void
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
