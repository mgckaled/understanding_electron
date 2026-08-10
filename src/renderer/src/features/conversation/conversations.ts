import type { AppError, Conversation, Message, MessageStopped } from '@shared/ipc'

/*
 * What survived the move to storage (plano 14).
 *
 * The reducer that used to live here is gone: the list and the transcripts are
 * now a server cache, and a client reducer holding them would be the stale copy
 * D13.2 was written to avoid. What is left is the shape the renderer composes
 * and the one decision about conversations that is genuinely the renderer's.
 */

export const DEFAULT_TITLE = 'Nova conversa'
const TITLE_MAX = 48

/**
 * A conversation together with its transcript.
 *
 * `Conversation` in the contract is the ROW (D14.1) — the sidebar lists rows,
 * and the transcript is a second read. This composite is how the renderer puts
 * the two back together for the conversation on screen, and it lives here and
 * not in `shared/` for the same reason `ViewState` does: main has no opinion
 * about it.
 */
export type ConversationWithMessages = Conversation & { messages: Message[] }

/**
 * The title of a conversation is its first user message, truncated (D13.9).
 * Free and instant, and it is what the user just wrote — the alternative of
 * asking the model for a title costs a round trip at 4–6 tok/s that competes
 * with the answer the user is waiting for. Not discarded, just expensive; the
 * trigger to reopen it is a cloud provider being in use.
 *
 * It stays in the renderer even though the title is now a column: main inserts
 * what it receives and never invents Portuguese (D14.5).
 */
export function titleFromText(text: string): string {
  const normalised = text.replace(/\s+/g, ' ').trim()
  if (normalised === '') return DEFAULT_TITLE
  return normalised.length <= TITLE_MAX ? normalised : `${normalised.slice(0, TITLE_MAX - 1)}…`
}

/**
 * Which failures leave a partial reply worth keeping (D14.3).
 *
 * Only the two interruptions do. `unavailable` and `upstream` produce nothing:
 * the failure is of the CALL, not a reply that got cut short, so there is no
 * text to keep and a marker would claim something that did not happen.
 *
 * The two are already distinguishable at this point — the handler's `timedOut`
 * flag maps them to different AppErrors, and the renderer reads the `kind`.
 */
export function stoppedFromError(error: AppError): MessageStopped | null {
  if (error.kind === 'cancelled') return 'cancelled'
  if (error.kind === 'timeout') return 'timeout'
  return null
}
