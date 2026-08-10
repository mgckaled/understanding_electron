import { z } from 'zod'

export type AppError =
  | { kind: 'not-found'; path: string }
  | { kind: 'permission'; path: string }
  | { kind: 'blocked'; reason: string }
  | { kind: 'cancelled' }
  | { kind: 'timeout'; afterMs: number }
  | { kind: 'unavailable'; service: string; hint: string }
  | { kind: 'upstream'; service: string; status: number | null; message: string }
  | { kind: 'unknown'; message: string }

export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E }

export type AppInfo = {
  electron: string
  chrome: string
  node: string
  app: string
  platform: NodeJS.Platform
  isDev: boolean
}

export type JobId = string

export type JobEvent =
  | { jobId: JobId; type: 'progress'; phase: string; done: number; total: number | null }
  | { jobId: JobId; type: 'chunk'; text: string }
  | { jobId: JobId; type: 'log'; level: 'info' | 'warn' | 'error'; message: string }

export type JobProgress = Extract<JobEvent, { type: 'progress' }>

export type DatasetSummary = {
  delimiter: string
  columns: string[]
  rowCount: number
}

export type DatasetRef = {
  path: string
}

// AI layer (plano 09, fatia 1). aiServiceSchema is the single source for the
// set of providers — z.infer keeps the type from being written in parallel.
// Cloud providers (gemini, glm) join this enum in step 3, never before.
export const aiServiceSchema = z.enum(['ollama'])
export type AiService = z.infer<typeof aiServiceSchema>

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string()
})
export type ChatRole = ChatMessage['role']
export type ChatMessage = z.infer<typeof chatMessageSchema>

export type ChatRequest = {
  service: AiService
  model: string
  messages: ChatMessage[]
  // Optional cap on the CPU threads Ollama uses for this call's inference —
  // maps to the request's options.num_thread. Undefined lets Ollama decide.
  numThread?: number
}

// The final, authoritative reply. Live tokens arrive first as JobEvent 'chunk'
// payloads; this is the assembled whole, mirroring how dataset:scan emits
// progress events yet still returns the final DatasetSummary as its Result.
export type ChatReply = {
  content: string
}

export type AiAvailability = {
  service: AiService
  version: string
}

// The application's conversation (D13.3). Distinct from ChatMessage above,
// which is the provider's wire shape and stays exactly as it is — a pure
// function translates one into the other, and that function is where plano 16
// hangs the three-level privacy boundary.
//
// The decision this encodes is that a message is a LIST OF TYPED PARTS, not a
// string with attachments hung beside it. Only 'text' is written here; the
// other variants ('image', 'dataset', 'proposal', 'result') are not features
// this plan builds. What is decided now is the SHAPE, because retrofitting it
// would touch this file, preload, renderer, main, and — from plano 14 on — the
// rows already written to disk. Case 1 of the rule in docs/HISTORY.md
// § flexibilidade é forma de dado e slot.
//
// The schemas were born in plano 14, together with the channels — a schema
// exists to validate an IPC payload, and until there was IPC there was none.
// The types are inferred from them and never written in parallel.
export const messagePartSchema = z.object({ kind: z.literal('text'), text: z.string() })
export type MessagePart = z.infer<typeof messagePartSchema>

export const messageRoleSchema = z.enum(['user', 'assistant'])
export type MessageRole = z.infer<typeof messageRoleSchema>

/**
 * Why a reply stopped before it finished (D14.3).
 *
 * A conversation that discards half an answer lies by omission: you remember
 * asking, the app shows the question with no answer, and there is no way to
 * tell "the model did not reply" from "I cancelled". With the marker the screen
 * says what happened, and the partial still informs the next turn — on a CPU
 * with no GPU, throwing away forty seconds of generation is expensive.
 */
export const messageStoppedSchema = z.enum(['cancelled', 'timeout'])
export type MessageStopped = z.infer<typeof messageStoppedSchema>

export const messageSchema = z.object({
  id: z.string().min(1),
  role: messageRoleSchema,
  parts: z.array(messagePartSchema).min(1),
  createdAt: z.number().int().nonnegative(),
  // The model that produced this message, recorded per message and not only
  // per conversation (D13.4). The model is deliberately NOT locked after the
  // first reply — on a local-model app "this 4B failed, move up to qwen 7B" is
  // the main recovery action — so a transcript can carry mixed authorship.
  // That is resolved with data, not with a prohibition.
  model: z.string().min(1).optional(),
  // A column, not a part: it is metadata ABOUT the turn, not content. Inside
  // `parts` the interface would have to open the JSON to know whether to draw
  // a label. Absent means the reply finished.
  stopped: messageStoppedSchema.optional()
})
export type Message = z.infer<typeof messageSchema>

/**
 * A conversation ROW — the shape of a line in the `conversations` table, and
 * what the sidebar lists. The transcript is a separate read (D14.1: a message
 * is a row, not an item inside a conversation blob), so `messages` is
 * deliberately absent here: loading every transcript to draw a list of titles
 * is the cost the relational shape exists to avoid.
 *
 * The renderer composes this with `conversation:messages` for the active
 * conversation; that composite type belongs to the renderer, not here, because
 * main has no opinion about it.
 */
export type Conversation = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

/*
 * Machine-scale configuration (D13.4/D14.7). The criterion is not "rarely
 * changed": it is a property OF THIS COMPUTER. Stored per conversation,
 * reopening an old one would restore a thread count belonging to a different
 * machine — hence its own key-value table, and not a conversation column.
 *
 * The table is key-value so a new setting costs no migration (plano 17 adds
 * the loaded-model policy as a new key). The CONTRACT is typed anyway: the
 * flexibility that pays is in storage, not in what crosses the boundary.
 */
export const appSettingsSchema = z.object({
  /** Cap on the CPU threads Ollama may use — maps to options.num_thread. */
  numThread: z.number().int().positive()
})
export type AppSettings = z.infer<typeof appSettingsSchema>

// Capped for a laptop already running VS Code, a browser and this agent. The
// inference lives in the Ollama process, so this is the one lever the app has
// over its CPU appetite. See plano 09 D9.1.
export const DEFAULT_APP_SETTINGS: AppSettings = { numThread: 4 }

// job:event is not an invoke/handle channel — ipcMain never `.handle()`s it,
// so it has no entry in argsSchema/IpcContract. main broadcasts JobEvent
// payloads through it and preload subscribes with ipcRenderer.on. Its name
// lives in shared/channels.ts, not here — see that file for why.

export const argsSchema = {
  'app:info': z.void(),
  'shell:openExternal': z.object({ url: z.string().url() }),
  'dataset:pick': z.void(),
  'dataset:scan': z.object({ path: z.string(), jobId: z.string() }),
  'job:cancel': z.object({ jobId: z.string() }),
  'ai:isAvailable': z.object({ service: aiServiceSchema }),
  'ai:chat': z.object({
    service: aiServiceSchema,
    model: z.string().min(1),
    messages: z.array(chatMessageSchema).min(1),
    numThread: z.number().int().positive().optional(),
    jobId: z.string()
  }),
  // Conversation storage (plano 14). The renderer mints `id` and stamps
  // `createdAt` (D14.5) — same argument as JobId: identity generated on the
  // side that acts does not have to wait for a reply to know what it is
  // talking about, and it makes invalidation predictable. So no handler here
  // generates identity or stamps time; it inserts what it receives.
  'conversation:list': z.void(),
  'conversation:messages': z.object({ conversationId: z.string().min(1) }),
  'conversation:create': z.object({
    id: z.string().min(1),
    title: z.string(),
    createdAt: z.number().int().nonnegative()
  }),
  'conversation:rename': z.object({ id: z.string().min(1), title: z.string() }),
  'conversation:remove': z.object({ id: z.string().min(1) }),
  // `title` present means "and rename it to this" — the first user message
  // becomes the title (D13.9), and the decision of what that title is stays in
  // the renderer, where `titleFromText` already lives and is tested. Folding it
  // into the append keeps one call, one invalidation, and no window in which
  // the sidebar shows a stale title.
  'conversation:append': z.object({
    conversationId: z.string().min(1),
    message: messageSchema,
    title: z.string().optional()
  }),
  'settings:read': z.void(),
  // A patch, not the whole object: a setting added later is written by whoever
  // owns it, without every writer having to know the full shape.
  'settings:write': appSettingsSchema.partial()
} as const

export type IpcContract = {
  'app:info': { args: z.infer<(typeof argsSchema)['app:info']>; result: AppInfo }
  'shell:openExternal': {
    args: z.infer<(typeof argsSchema)['shell:openExternal']>
    result: Result<void>
  }
  'dataset:pick': {
    args: z.infer<(typeof argsSchema)['dataset:pick']>
    result: Result<DatasetRef | null>
  }
  'dataset:scan': {
    args: z.infer<(typeof argsSchema)['dataset:scan']>
    result: Result<DatasetSummary>
  }
  'job:cancel': { args: z.infer<(typeof argsSchema)['job:cancel']>; result: void }
  'ai:isAvailable': {
    args: z.infer<(typeof argsSchema)['ai:isAvailable']>
    result: Result<AiAvailability>
  }
  'ai:chat': {
    args: z.infer<(typeof argsSchema)['ai:chat']>
    result: Result<ChatReply>
  }
  // None of the conversation channels returns Result, and that is a decision,
  // not an omission. Result exists for failures the UI has to REACT to — file
  // missing, service down, user cancelled. An indexed insert into a local
  // SQLite file has no such failure: what is left is programming defect, which
  // must throw and hurt in the console. Wrapping everything trains the reader
  // to ignore `ok`. Absence is expressed as data instead: an empty list, and an
  // append addressed to a conversation that is gone is dropped (see handlers).
  'conversation:list': {
    args: z.infer<(typeof argsSchema)['conversation:list']>
    result: Conversation[]
  }
  'conversation:messages': {
    args: z.infer<(typeof argsSchema)['conversation:messages']>
    result: Message[]
  }
  'conversation:create': {
    args: z.infer<(typeof argsSchema)['conversation:create']>
    result: void
  }
  'conversation:rename': {
    args: z.infer<(typeof argsSchema)['conversation:rename']>
    result: void
  }
  'conversation:remove': {
    args: z.infer<(typeof argsSchema)['conversation:remove']>
    result: void
  }
  'conversation:append': {
    args: z.infer<(typeof argsSchema)['conversation:append']>
    result: void
  }
  'settings:read': { args: z.infer<(typeof argsSchema)['settings:read']>; result: AppSettings }
  'settings:write': { args: z.infer<(typeof argsSchema)['settings:write']>; result: void }
}

export type Channel = keyof IpcContract
export type Args<C extends Channel> = IpcContract[C]['args']
export type ResultOf<C extends Channel> = IpcContract[C]['result']

export type Api = {
  app: { info(): Promise<AppInfo> }
  shell: { openExternal(url: string): Promise<Result<void>> }
  dataset: {
    pick(): Promise<Result<DatasetRef | null>>
    scan(path: string, jobId: JobId): Promise<Result<DatasetSummary>>
  }
  job: {
    cancel(jobId: JobId): Promise<void>
    onEvent(cb: (event: JobEvent) => void): () => void
  }
  ai: {
    isAvailable(service: AiService): Promise<Result<AiAvailability>>
    // Live tokens stream through job.onEvent as 'chunk' events keyed by jobId;
    // the resolved Result carries the assembled whole.
    chat(request: ChatRequest, jobId: JobId): Promise<Result<ChatReply>>
  }
  conversation: {
    /** Newest first — `ORDER BY updated_at DESC`, the sidebar's own order. */
    list(): Promise<Conversation[]>
    /** The transcript of one conversation, oldest first. */
    messages(conversationId: string): Promise<Message[]>
    create(conversation: Omit<Conversation, 'updatedAt'>): Promise<void>
    rename(id: string, title: string): Promise<void>
    remove(id: string): Promise<void>
    append(conversationId: string, message: Message, title?: string): Promise<void>
  }
  settings: {
    read(): Promise<AppSettings>
    write(patch: Partial<AppSettings>): Promise<void>
  }
}
