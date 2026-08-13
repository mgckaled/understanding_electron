import type { AiModel, AppError, Conversation, Message, MessageStopped } from '@shared/ipc'
import { hasCapability } from '@core/ai/models'

// What survived the move to storage (plano 14): the reducer is gone — the list
// and transcripts are a server cache now, and a client reducer holding them
// would be the stale copy D13.2 exists to avoid. What is left is the composite
// shape and the decisions genuinely the renderer's.

export const DEFAULT_TITLE = 'Nova conversa'
const TITLE_MAX = 48

/**
 * A conversation together with its transcript. `Conversation` in the contract is
 * the ROW (D14.1) and the transcript is a second read; this composite reunites
 * them for the conversation on screen. It lives here, not in `shared/`, for the
 * same reason `ViewState` does: main has no opinion about it.
 */
export type ConversationWithMessages = Conversation & {
  messages: Message[]
  /**
   * Whether the transcript read has landed. `messages` is `[]` while in flight,
   * indistinguishable from an empty conversation — and the two differ on whether
   * the pair is locked (D15.13), so the caller assumes locked until this is true.
   */
  messagesLoaded: boolean
}

/**
 * A conversation's title is its first user message, truncated (D13.9): free and
 * what the user just wrote, versus a model round trip at 4–6 tok/s competing
 * with the answer they wait for (expensive, not discarded; reopens with a cloud
 * provider). In the renderer because main inserts what it receives and never
 * invents Portuguese (D14.5).
 */
export function titleFromText(text: string): string {
  const normalised = text.replace(/\s+/g, ' ').trim()
  if (normalised === '') return DEFAULT_TITLE
  return normalised.length <= TITLE_MAX ? normalised : `${normalised.slice(0, TITLE_MAX - 1)}…`
}

/**
 * Which failures leave a partial reply worth keeping (D14.3): only the two
 * interruptions. `unavailable` and `upstream` produce nothing — the CALL failed,
 * not a reply cut short, so a marker would claim something that never happened.
 * The two are already distinct here via the handler's `timedOut` flag.
 */
export function stoppedFromError(error: AppError): MessageStopped | null {
  if (error.kind === 'cancelled') return 'cancelled'
  if (error.kind === 'timeout') return 'timeout'
  return null
}

/**
 * The models worth offering for a conversation (D15.11): everything installed,
 * minus what cannot converse and minus a variant whose parent is also listed
 * (the parent must be PRESENT to drop it, else the variant is the only way to
 * run those weights). Filtered here, not in main: what is installed is a fact,
 * what is worth offering is a judgement about a UI.
 */
export function selectableModels(catalog: AiModel[]): AiModel[] {
  const installed = new Set(catalog.map((model) => model.name))
  return catalog.filter(
    (model) =>
      hasCapability(model, 'completion') &&
      (model.variantOf === null || !installed.has(model.variantOf))
  )
}

/**
 * Which model a conversation is actually sent with (D15.2). No hardcoded default
 * any more (it was `gemma3:4b` in a component, which let the app send a name to
 * an Ollama that never pulled it and get a blind `upstream` error). `null` means
 * nothing to address a call to — a state the selector draws. Once LOCKED, the
 * fallback to the first installed model is dropped: it is the instability the
 * lock removes (D15.13). Here, not in `core/`, like `titleFromText`: main has no
 * opinion about which model a UI preselects.
 */
export function resolveModel(
  chosen: string | undefined,
  catalog: AiModel[],
  locked: boolean
): string | null {
  if (chosen !== undefined && catalog.some((model) => model.name === chosen)) return chosen
  return locked ? null : (catalog[0]?.name ?? null)
}

export type ConversationDateLabel = 'Hoje' | 'Ontem' | 'Anteriores'

export type ConversationGroup = {
  label: ConversationDateLabel
  conversations: Conversation[]
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Buckets conversations into Hoje / Ontem / Anteriores by `updatedAt`, relative
 * to `now` PASSED IN — never read from the clock here, so the level-1 test does
 * not depend on the wall time and stops breaking at midnight. Order within a
 * bucket is the input's, which the store already keeps as `updated_at DESC`.
 * Empty buckets are dropped, so the sidebar never shows a label with nothing
 * under it.
 */
export function groupByDate(conversations: Conversation[], now: number): ConversationGroup[] {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0)
  const startOfYesterday = startOfToday - DAY_MS
  const buckets: Record<ConversationDateLabel, Conversation[]> = {
    Hoje: [],
    Ontem: [],
    Anteriores: []
  }
  for (const conversation of conversations) {
    if (conversation.updatedAt >= startOfToday) buckets.Hoje.push(conversation)
    else if (conversation.updatedAt >= startOfYesterday) buckets.Ontem.push(conversation)
    else buckets.Anteriores.push(conversation)
  }
  const order: ConversationDateLabel[] = ['Hoje', 'Ontem', 'Anteriores']
  return order
    .map((label) => ({ label, conversations: buckets[label] }))
    .filter((group) => group.conversations.length > 0)
}
