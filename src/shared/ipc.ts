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

/**
 * Free memory as of the moment it was asked for (D15.2). Not part of AppInfo,
 * which is immutable facts about the build: this changes while the app is open,
 * and treating it as static is what a cached ceiling would get wrong.
 */
export type SystemMemory = {
  freeBytes: number
  totalBytes: number
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
  // The context window to reserve for this call — maps to options.num_ctx.
  // Undefined lets Ollama decide, which on this machine means 4096: a number
  // nobody chose, and small enough that a single 8k-token document overflows
  // it on its own (D15.2).
  numCtx?: number
}

// The final, authoritative reply. Live tokens arrive first as JobEvent 'chunk'
// payloads; this is the assembled whole, mirroring how dataset:scan emits
// progress events yet still returns the final DatasetSummary as its Result.
export type ChatReply = {
  content: string
  /**
   * Tokens the provider actually read from the prompt, and produced (D15.4).
   *
   * `promptTokens` is the ONLY exact count available: there is no
   * tokenize-before-sending — /api/tokenize returns 404 on this runtime — so
   * every estimate before the call is characters divided by a ratio. This
   * number comes back after, and dividing it by the characters that were sent
   * gives the real density OF THIS CONVERSATION, which calibrates the next
   * estimate.
   *
   * It is also the only evidence of silent truncation: when it comes back
   * SMALLER than what was sent, the provider dropped the beginning and answered
   * anyway.
   *
   * Optional because a cloud provider may not report them, and their absence
   * must not break anything — the meter degrades to an estimate, which is what
   * it already is on the first turn.
   */
  promptTokens?: number
  evalTokens?: number
}

export type AiAvailability = {
  service: AiService
  version: string
}

/**
 * The attention parameters that decide what a context window COSTS in RAM
 * (D15.2). They ride along for free: the same /api/show response that carries
 * `contextLength` carries these, so reading them adds no network call.
 *
 * Without them the selector would offer whatever ceiling the model declares —
 * and phi4-mini declares 131072, which is 16 GB of KV cache on a 16 GB machine.
 * The true datum and the right answer diverge, which is exactly the case a
 * derived bound exists for.
 *
 * `null` when model_info has no usable attention block — an embedder, or a
 * shape this build does not recognize. Absence is data: the budget math simply
 * declines to bound such a model instead of guessing.
 */
export type AiModelAttention = {
  blockCount: number
  headCountKv: number
  /** attention.key_length when present, else embedding_length / head_count. */
  headDim: number
  /**
   * Declaring a window is NOT enough to be cheap: phi4-mini declares 262144,
   * double its own context ceiling, so the window never closes over anything.
   * Whoever consumes this compares it against contextLength — see core/ai.
   */
  slidingWindow: number | null
}

/**
 * A model the app can talk to, normalized away from any one provider's wire
 * shape (D15.1).
 *
 * `capabilities` is string[] and not a closed union on purpose, and that stopped
 * being a precaution in ago/2026: the qwen2.5-coder models arrived declaring
 * `insert`, a fourth capability no model in the fleet had. A z.enum would have
 * turned a newly installed model into a parse error for the whole catalog.
 * Enumerating a third party's vocabulary is a bet that the third party stopped
 * working. Ask about a capability through core/ai, never by indexing this.
 *
 * `provider` carries one value today (D15.9). It exists now because adding it
 * later would touch this file, preload, renderer, main and every settings blob
 * already on disk — the same argument that made Message a list of parts.
 */
export type AiModel = {
  provider: AiService
  name: string
  /** '4.3B' — details.parameter_size, shown as-is; never parsed. */
  parameterSize: string
  sizeBytes: number
  capabilities: string[]
  contextLength: number | null
  attention: AiModelAttention | null
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
 * What a conversation chooses for itself (D15.2). Conversation scale and not
 * machine scale by the D13.4 ruler: both of these change WHAT THE MODEL
 * ANSWERS — `numCtx` changes how much of its own history it can see — whereas
 * `numThread` is a property of this computer.
 *
 * Every field is optional, and that is the whole design: absent means "the
 * app's default", so a conversation created before a setting existed needs no
 * migration and no backfill. It lands in the `settings` JSON column that D14.1
 * created empty, which is why this plan adds no CREATE TABLE.
 *
 * Plano 15 writes two keys; the system prompt joins them the day there is
 * something to put in it.
 */
export const conversationSettingsSchema = z.object({
  model: z.string().min(1).optional(),
  /** Context window reserved for this conversation — maps to options.num_ctx. */
  numCtx: z.number().int().positive().optional()
})
export type ConversationSettings = z.infer<typeof conversationSettingsSchema>

/**
 * A conversation ROW — the shape of a line in the `conversations` table, and
 * what the sidebar lists. The transcript is a separate read (D14.1: a message
 * is a row, not an item inside a conversation blob), so `messages` is
 * deliberately absent here: loading every transcript to draw a list of titles
 * is the cost the relational shape exists to avoid.
 *
 * `settings` DOES ride along (D15.6), and that is a different question from the
 * one D14.1 answered. It is a couple of hundred bytes already sitting in the
 * row, and the active conversation needs it before any send — a separate read
 * would be a second trip for data that already arrived. The trigger to split it
 * is written down: `settings` growing to hold a long system prompt, at which
 * point the list would carry kilobytes per conversation to draw titles.
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
  settings: ConversationSettings
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
  'app:memory': z.void(),
  'shell:openExternal': z.object({ url: z.string().url() }),
  'dataset:pick': z.void(),
  'dataset:scan': z.object({ path: z.string(), jobId: z.string() }),
  'job:cancel': z.object({ jobId: z.string() }),
  'ai:isAvailable': z.object({ service: aiServiceSchema }),
  // N+1 requests behind one channel (D15.1): /api/tags does not report `vision`
  // and does not report any context ceiling, so each model needs its own
  // /api/show. Measured at 4,9 s for 14 models, and it loads nothing — the cost
  // is latency, not RAM. Cached by the renderer with an infinite staleTime and
  // a reload button, because installing a model is a system event the app has
  // no way to observe.
  'ai:models': z.object({ service: aiServiceSchema }),
  'ai:chat': z.object({
    service: aiServiceSchema,
    model: z.string().min(1),
    messages: z.array(chatMessageSchema).min(1),
    numThread: z.number().int().positive().optional(),
    numCtx: z.number().int().positive().optional(),
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
  // A merge patch, like settings:write and for the same reason: a key added
  // later is written by whoever owns it, without every writer having to know
  // the full shape. Applied with SQLite's json_patch so it is one atomic
  // statement instead of read-modify-write — and a null value removes its key,
  // which is RFC 7386 merge-patch semantics and how a setting goes back to the
  // app default.
  'conversation:settings': z.object({
    id: z.string().min(1),
    patch: conversationSettingsSchema
  }),
  'settings:read': z.void(),
  // A patch, not the whole object: a setting added later is written by whoever
  // owns it, without every writer having to know the full shape.
  'settings:write': appSettingsSchema.partial()
} as const

export type IpcContract = {
  'app:info': { args: z.infer<(typeof argsSchema)['app:info']>; result: AppInfo }
  // No Result: reading the machine's own memory counters cannot fail in a way
  // the UI has to distinguish, and wrapping it would train the reader to ignore
  // `ok` — the same reasoning app:info already carries.
  'app:memory': { args: z.infer<(typeof argsSchema)['app:memory']>; result: SystemMemory }
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
  // Result, unlike the conversation channels: the provider being down is a
  // failure the UI has to react to (empty selector with a hint), not a
  // programming defect. Same reasoning as ai:isAvailable.
  'ai:models': {
    args: z.infer<(typeof argsSchema)['ai:models']>
    result: Result<AiModel[]>
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
  'conversation:settings': {
    args: z.infer<(typeof argsSchema)['conversation:settings']>
    result: void
  }
  'settings:read': { args: z.infer<(typeof argsSchema)['settings:read']>; result: AppSettings }
  'settings:write': { args: z.infer<(typeof argsSchema)['settings:write']>; result: void }
}

export type Channel = keyof IpcContract
export type Args<C extends Channel> = IpcContract[C]['args']
export type ResultOf<C extends Channel> = IpcContract[C]['result']

export type Api = {
  app: {
    info(): Promise<AppInfo>
    /** Read fresh each call — see SystemMemory for why it is never cached. */
    memory(): Promise<SystemMemory>
  }
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
    /** The installed models, with capabilities and context ceiling (D15.1). */
    models(service: AiService): Promise<Result<AiModel[]>>
    // Live tokens stream through job.onEvent as 'chunk' events keyed by jobId;
    // the resolved Result carries the assembled whole.
    chat(request: ChatRequest, jobId: JobId): Promise<Result<ChatReply>>
  }
  conversation: {
    /** Newest first — `ORDER BY updated_at DESC`, the sidebar's own order. */
    list(): Promise<Conversation[]>
    /** The transcript of one conversation, oldest first. */
    messages(conversationId: string): Promise<Message[]>
    // `settings` is omitted, not defaulted: the column already defaults to an
    // empty object, so a caller passing one would be duplicating that decision.
    create(conversation: Omit<Conversation, 'updatedAt' | 'settings'>): Promise<void>
    rename(id: string, title: string): Promise<void>
    remove(id: string): Promise<void>
    append(conversationId: string, message: Message, title?: string): Promise<void>
    /** Merge-patches this conversation's settings; absent keys are untouched. */
    updateSettings(id: string, patch: ConversationSettings): Promise<void>
  }
  settings: {
    read(): Promise<AppSettings>
    write(patch: Partial<AppSettings>): Promise<void>
  }
}
