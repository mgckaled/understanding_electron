import type {
  Conversation,
  ConversationSettings,
  Message,
  MessagePart,
  MessageRole,
  MessageStopped
} from '@shared/ipc'
import { conversationSettingsSchema } from '@shared/ipc'

// node:sqlite hands back a loose Record with no row generic, so the typing is
// rebuilt at this edge in one place to keep casts from spreading across six
// handlers. These do NOT validate with zod, on purpose (skill `architecture`:
// zod on the way in, never out): main wrote these rows, and a corrupted `parts`
// makes JSON.parse throw — the right answer for corrupted storage, a loud defect.

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
 * The one read here that IS validated (same exception readSettings makes): these
 * bytes came off DISK, possibly from an older build, and for a schemaless JSON
 * blob validating here IS the migration path. It degrades to "nothing chosen" —
 * what a new conversation looks like, so the app uses its defaults — rather than
 * throwing like `parts` and taking the whole sidebar down over one re-pickable row.
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
