import { createContext, useContext } from 'react'
import type { DocumentPart, ImagePart } from '@shared/ipc'

/**
 * Anything a conversation can open in the side panel (DF3A.2).
 *
 * Deliberately NOT `AttachmentPart`: a chart or a result (plano 20) is born
 * from a message, not from a file, so reusing the attachment union would make
 * that day a boundary rewrite instead of a new member here.
 *
 * `id` is what tells a card it is the one on screen — the attachment hash
 * today. Two cards of the same file share it and both mark themselves, which
 * is correct: the panel is showing exactly their content.
 */
export type ArtifactRef =
  | { kind: 'document'; id: string; part: DocumentPart }
  | { kind: 'image'; id: string; part: ImagePart }

export type ArtifactApi = {
  current: ArtifactRef | null
  /**
   * Every artifact this conversation can open, oldest first.
   *
   * Lives here, not in each consumer: the header clip and the panel's picker
   * both need it, and deriving it twice from two places is how the number on
   * one and the length of the other start disagreeing.
   */
  artifacts: ArtifactRef[]
  /**
   * Opens `ref` in the panel, or closes the panel when `ref` is already the
   * open one — the card stays dumb and this rule lives in one place.
   *
   * @param trigger - The element that opened it, so focus can return there on
   *   close (DF3A.8). `null` when nothing should be focused back.
   */
  toggle: (ref: ArtifactRef, trigger: HTMLElement | null) => void
  /**
   * Opens the newest artifact, or closes whatever is open (DF3B.1).
   *
   * Lives here because it has two callers that must never disagree — the
   * header clip and `Ctrl+B` — and "which one does the panel open" is a rule,
   * not a line of markup.
   */
  togglePanel: (trigger: HTMLElement | null) => void
  close: () => void
}

export const ArtifactContext = createContext<ArtifactApi | null>(null)

export function useArtifact(): ArtifactApi {
  const value = useContext(ArtifactContext)
  if (value === null) {
    throw new Error('useArtifact must be called inside <ArtifactProvider>.')
  }
  return value
}
