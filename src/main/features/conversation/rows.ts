import type {
  Conversation,
  ConversationSettings,
  Message,
  MessagePart,
  MessageRole,
  MessageStopped
} from '@shared/ipc'
import { conversationSettingsSchema } from '@shared/ipc'

/*
 * node:sqlite hands back `Record<string, null | number | bigint | string |
 * Uint8Array>` — there is no row generic like better-sqlite3's. So the typing
 * has to be rebuilt at this edge, and doing it in one place is what keeps the
 * casts from spreading across six handlers.
 *
 * These do NOT validate with zod, on purpose. The rule is zod on the arguments
 * crossing renderer → main, never on the way out (skill `architecture`): main
 * wrote these rows itself, and re-parsing its own writes is distrusting itself
 * at the cost of latency on every read. A corrupted `parts` payload makes
 * JSON.parse throw, which is the right answer for corrupted storage — a defect,
 * loud, not a Result the UI is asked to render.
 */

type Row = Record<string, unknown>

export function toConversation(row: Row): Conversation {
  return {
    id: String(row['id']),
    title: String(row['title']),
    // Number() and not a cast: the probe says milliseconds come back as
    // `number`, but a value above 2^53 would arrive as BigInt and silently
    // break every comparison downstream.
    createdAt: Number(row['created_at']),
    updatedAt: Number(row['updated_at']),
    settings: toConversationSettings(row['settings'])
  }
}

/**
 * The one read in this file that IS validated, and it is the same exception
 * readSettings makes for app_settings rather than a new one: these bytes came
 * off DISK, possibly written by an older build, and the migration ladder has
 * nothing to migrate for a schemaless JSON blob. Validating here IS the
 * migration path.
 *
 * Note what it degrades to. A blob this build cannot read becomes "nothing
 * chosen", which is precisely what a brand-new conversation looks like, so the
 * app falls back to its own defaults. The alternative — throwing, as `parts`
 * does — would make one bad row take down the whole sidebar, and unlike a
 * corrupted transcript there is nothing here that cannot simply be picked again.
 */
function toConversationSettings(value: unknown): ConversationSettings {
  try {
    const parsed = conversationSettingsSchema.safeParse(JSON.parse(String(value ?? '{}')))
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

/** True for a column that holds an actual value — SQL NULL arrives as `null`. */
function filled(value: unknown): value is string {
  return value !== null && value !== undefined
}

export function toMessage(row: Row): Message {
  const message: Message = {
    id: String(row['id']),
    role: String(row['role']) as MessageRole,
    parts: JSON.parse(String(row['parts'])) as MessagePart[],
    createdAt: Number(row['created_at'])
  }
  // A NULL column becomes an ABSENT key, never `model: null`. The contract says
  // `model?: string`, and a null would typecheck nowhere while rendering as the
  // string "null" somewhere on screen.
  if (filled(row['model'])) message.model = String(row['model'])
  if (filled(row['stopped'])) message.stopped = String(row['stopped']) as MessageStopped
  return message
}
