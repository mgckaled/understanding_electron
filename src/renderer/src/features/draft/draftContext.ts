import { createContext, useContext } from 'react'
import type { Draft } from '@shared/ipc'

export type DraftApi = {
  /** This conversation's drafts, oldest first. */
  drafts: Draft[]
  /** The draft on screen, or `null` when the region shows something else. */
  current: Draft | null
  /** Whether this answer already produced a draft — the turn button's state (DE1A.3). */
  hasDraftOf: (messageId: string) => boolean
  createFrom: (sourceMessageId: string, content: string, code?: { language: string | null }) => void
  /** Rewrites one draft; the title is re-derived from the text (DE1C.7). */
  update: (id: string, content: string) => void
  remove: (id: string) => void
  /**
   * Shows `draft`, or closes the panel when it is already the one open.
   *
   * @param trigger - Where focus returns on close (DF3A.8); `null` for nothing.
   */
  toggle: (draft: Draft, trigger: HTMLElement | null) => void
  /** Opens the newest draft, or closes whatever is open — the counter's action. */
  togglePanel: (trigger: HTMLElement | null) => void
  close: () => void
}

export const DraftContext = createContext<DraftApi | null>(null)

export function useDraft(): DraftApi {
  const value = useContext(DraftContext)
  if (value === null) {
    throw new Error('useDraft must be called inside <DraftProvider>.')
  }
  return value
}
