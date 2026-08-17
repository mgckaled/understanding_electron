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

// Reused as the picked-but-not-yet-attached result of document:pick too
// (plano 17): the shape is a path, nothing dataset-specific about it.
export type DatasetRef = {
  path: string
  /**
   * Bytes on disk, when the caller already stat'd it cheaply (D17.10) —
   * document:pick does, so the progress label can show a time estimate
   * before the read starts. dataset:pick leaves it undefined: its progress
   * is row-based, not time-based.
   */
  sizeBytes?: number
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
  /** Cap on CPU threads for this call's inference — options.num_thread. Undefined lets Ollama decide. */
  numThread?: number
  /**
   * Context window to reserve — options.num_ctx. Undefined lets Ollama decide,
   * which here means 4096: a number nobody chose that one 8k-token document
   * overflows (D15.2).
   */
  numCtx?: number
}

/**
 * The final, authoritative reply. Live tokens arrive first as JobEvent 'chunk'
 * payloads; this is the assembled whole.
 */
export type ChatReply = {
  content: string
  /**
   * Tokens the provider read from the prompt, and produced (D15.4). The ONLY
   * exact count — nothing tokenizes before sending — so dividing it by the chars
   * sent calibrates the next estimate; when it comes back SMALLER than sent, the
   * provider silently truncated. Optional: a cloud provider may not report it,
   * and the meter degrades to the estimate it already is on the first turn.
   */
  promptTokens?: number
  evalTokens?: number
}

export type AiAvailability = {
  service: AiService
  version: string
  /** Display form of the provider's endpoint (e.g. `127.0.0.1:11434`) — absent
   *  for a provider with no host:port to show, like a future cloud one. */
  host?: string
}

/**
 * The attention parameters that decide what a context window COSTS in RAM
 * (D15.2). They ride along free — the same /api/show response that carries
 * `contextLength` carries these — and without them the selector would offer
 * phi4-mini's declared 131072, which is 16 GB of KV cache on a 16 GB machine.
 * `null` for an embedder or an unrecognized shape: absence is data, and the
 * budget math declines to bound such a model instead of guessing.
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
 * A model the app can talk to, normalized away from any provider's wire shape
 * (D15.1). `capabilities` is string[], not a closed union, on purpose: the
 * qwen2.5-coder models arrived declaring a fourth capability (`insert`), and a
 * z.enum would have turned a new model into a parse error for the whole catalog
 * — ask through core/ai, never by indexing this. `provider` carries one value
 * today (D15.9); it exists now because adding it later would touch every layer
 * and every settings blob on disk.
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
  /**
   * The model this was derived from with `ollama create` — same weights under
   * two names (D15.11); null for a registry pull. The parent's NAME, not a
   * boolean, because hiding a variant means first checking the parent is
   * installed: with it gone, the variant is the only way to run those weights.
   */
  variantOf: string | null
}

/**
 * A model the provider is holding in memory right now — `/api/ps`. Distinct
 * from `AiModel` (what is INSTALLED): one is disk, the other RAM, and RAM is the
 * scarce one. Weights stay resident five minutes after the last request, long
 * enough to make the rest of the fleet read as "não cabe" while nothing runs.
 */
export type LoadedModel = {
  name: string
  /** Resident bytes, as the provider reports them — not the size on disk. */
  sizeBytes: number
  /** Epoch ms at which the provider will drop it. */
  expiresAt: number
}

// The application's conversation message (D13.3), distinct from ChatMessage
// (the provider's wire shape); a pure function translates one to the other, and
// that function is where plano 16 hangs the three-level privacy boundary. The
// decision encoded here is that a message is a LIST OF TYPED PARTS, not a string
// with attachments beside it — only 'text' was written until plano 16; fixing
// the SHAPE later would have touched every layer and the rows already on disk
// (D13.3 § slot). The schemas were born with the channels in plano 14; the
// types are inferred.
export const textPartSchema = z.object({ kind: z.literal('text'), text: z.string() })
export type TextPart = z.infer<typeof textPartSchema>

/**
 * A dataset attached to a message (plano 16, D16.4) — level 1 (schema) plus
 * row count, produced once by `dataset:attach` and stored inline: cheap enough
 * (measured: 51-180 tokens at 5-40 columns) that re-deriving it from the hash
 * on every read would trade a file stat for nothing. `hash` addresses
 * `userData/attachments/<hash>` (D16.3); no `path` — the source file may move
 * or vanish, the stored copy may not.
 */
export const datasetPartSchema = z.object({
  kind: z.literal('dataset'),
  hash: z.string().min(1),
  fileName: z.string().min(1),
  delimiter: z.string(),
  columns: z.array(z.string()),
  rowCount: z.number().int().nonnegative()
})
export type DatasetPart = z.infer<typeof datasetPartSchema>

/**
 * A document attached to a message (plano 17, D17.2) — `text` carries the
 * whole extraction inline, produced once by `document:attach`: the chat is
 * stateless and resends the transcript every turn, so what must not repeat is
 * the extraction (`unpdf` for a PDF), not the resend. `hash` addresses
 * `userData/attachments/<hash>` (D16.3); no `path`, same reasoning as
 * DatasetPart.
 */
export const documentPartSchema = z.object({
  kind: z.literal('document'),
  hash: z.string().min(1),
  fileName: z.string().min(1),
  format: z.enum(['txt', 'md', 'pdf']),
  text: z.string()
})
export type DocumentPart = z.infer<typeof documentPartSchema>

/**
 * Every attachment kind a message can carry (D17.4) — the composer's pending
 * slot and the conversation view's per-message card dispatch type against
 * this, not DatasetPart by name, so a member joining later (image) touches
 * one union instead of every consumer.
 */
export type AttachmentPart = DatasetPart | DocumentPart

export const messagePartSchema = z.discriminatedUnion('kind', [
  textPartSchema,
  datasetPartSchema,
  documentPartSchema
])
export type MessagePart = z.infer<typeof messagePartSchema>

export const messageRoleSchema = z.enum(['user', 'assistant'])
export type MessageRole = z.infer<typeof messageRoleSchema>

/**
 * Why a reply stopped before finishing (D14.3). Without the marker a discarded
 * half-answer lies by omission — you cannot tell "the model did not reply" from
 * "I cancelled" — and the partial still informs the next turn, which on a
 * GPU-less CPU is forty seconds of generation not thrown away.
 */
export const messageStoppedSchema = z.enum(['cancelled', 'timeout'])
export type MessageStopped = z.infer<typeof messageStoppedSchema>

export const messageSchema = z.object({
  id: z.string().min(1),
  role: messageRoleSchema,
  parts: z.array(messagePartSchema).min(1),
  createdAt: z.number().int().nonnegative(),
  /**
   * The model that produced this message, recorded per message (D13.4). Kept
   * even though the pair locks on the first send (D15.13): a locked model can be
   * uninstalled and the app's default moves between sessions.
   */
  model: z.string().min(1).optional(),
  /**
   * A column, not a part: metadata ABOUT the turn, not content — inside `parts`
   * the interface would open the JSON to know whether to draw a label. Absent
   * means the reply finished.
   */
  stopped: messageStoppedSchema.optional()
})
export type Message = z.infer<typeof messageSchema>

/**
 * What a conversation chooses for itself (D15.2) — conversation scale, not
 * machine scale (D13.4): both change WHAT THE MODEL ANSWERS, whereas `numThread`
 * is a property of this computer. Every field optional by design: absent means
 * "the app's default", so a conversation predating a setting needs no migration.
 * It lands in the `settings` JSON column D14.1 created, so this plan adds no
 * CREATE TABLE.
 */
export const conversationSettingsSchema = z.object({
  model: z.string().min(1).optional(),
  /** Context window reserved for this conversation — maps to options.num_ctx. */
  numCtx: z.number().int().positive().optional()
})
export type ConversationSettings = z.infer<typeof conversationSettingsSchema>

/**
 * A conversation ROW — a line in the `conversations` table, what the sidebar
 * lists. The transcript is a separate read (D14.1: a message is a row, not an
 * item in a blob), so `messages` is absent here — loading every transcript to
 * draw a list of titles is the cost the relational shape avoids. `settings` DOES
 * ride along (D15.6): a couple hundred bytes already in the row that the active
 * conversation needs before any send. The renderer composes this with
 * `conversation:messages`; that composite type belongs to the renderer.
 */
export type Conversation = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  settings: ConversationSettings
}

// Machine-scale configuration (D13.4/D14.7): a property OF THIS COMPUTER, not
// "rarely changed". Stored per conversation, reopening an old one would restore
// a thread count from a different machine — hence its own key-value table. The
// table is key-value so a new setting costs no migration; the CONTRACT is typed
// anyway, because the flexibility that pays is in storage, not at the boundary.
/** `system` follows `nativeTheme.shouldUseDarkColors`; `light`/`dark` override it (DS4.2). */
export const themeSchema = z.enum(['system', 'light', 'dark'])
export type Theme = z.infer<typeof themeSchema>

export const appSettingsSchema = z.object({
  /** Cap on the CPU threads Ollama may use — maps to options.num_thread. */
  numThread: z.number().int().positive(),
  theme: themeSchema
})
export type AppSettings = z.infer<typeof appSettingsSchema>

// Capped for a laptop already running VS Code, a browser and this agent. The
// inference lives in the Ollama process, so this is the one lever the app has
// over its CPU appetite. See plano 09 D9.1.
export const DEFAULT_APP_SETTINGS: AppSettings = { numThread: 4, theme: 'system' }

// job:event is not an invoke/handle channel — ipcMain never `.handle()`s it,
// so it has no entry in argsSchema/IpcContract. main broadcasts JobEvent
// payloads through it and preload subscribes with ipcRenderer.on. Its name
// lives in shared/channels.ts, not here — see that file for why.

export const argsSchema = {
  'app:info': z.void(),
  'app:memory': z.void(),
  'shell:openExternal': z.object({ url: z.string().url() }),
  'dataset:pick': z.void(),
  'dataset:attach': z.object({ path: z.string(), jobId: z.string() }),
  // Its own pair (D17.1): dataset:pick's file filter (csv/tsv/txt) does not
  // serve a document dialog, so a shared channel would need an internal
  // dispatch register-all.ts already gets for free by picking the function.
  'document:pick': z.void(),
  'document:attach': z.object({ path: z.string(), jobId: z.string() }),
  'job:cancel': z.object({ jobId: z.string() }),
  'ai:isAvailable': z.object({ service: aiServiceSchema }),
  // N+1 behind one channel (D15.1): /api/tags omits `vision` and the context
  // ceiling, so each model needs its own /api/show (~4,9 s for 14, loads
  // nothing). Renderer caches with infinite staleTime and a reload button,
  // since installing a model is a system event the app cannot observe.
  'ai:models': z.object({ service: aiServiceSchema }),
  // What is resident, and letting go of it. Two channels and not one because
  // one is a question and the other is an action — merging them would make a
  // cached query carry a side effect.
  'ai:loaded': z.object({ service: aiServiceSchema }),
  'ai:unload': z.object({ service: aiServiceSchema, model: z.string().min(1) }),
  'ai:chat': z.object({
    service: aiServiceSchema,
    model: z.string().min(1),
    messages: z.array(chatMessageSchema).min(1),
    numThread: z.number().int().positive().optional(),
    numCtx: z.number().int().positive().optional(),
    jobId: z.string()
  }),
  // Conversation storage (plano 14). The renderer mints `id` and stamps
  // `createdAt` (D14.5) — identity generated on the side that acts, like JobId,
  // so no handler here generates identity or time; it inserts what it receives.
  'conversation:list': z.void(),
  'conversation:messages': z.object({ conversationId: z.string().min(1) }),
  'conversation:create': z.object({
    id: z.string().min(1),
    title: z.string(),
    createdAt: z.number().int().nonnegative()
  }),
  'conversation:rename': z.object({ id: z.string().min(1), title: z.string() }),
  'conversation:remove': z.object({ id: z.string().min(1) }),
  // `title` present means "and rename to this" — the first user message becomes
  // the title (D13.9), decided in the renderer where `titleFromText` lives.
  // Folding it into the append keeps one call and no stale-title window.
  'conversation:append': z.object({
    conversationId: z.string().min(1),
    message: messageSchema,
    title: z.string().optional()
  }),
  // A merge patch, like settings:write: a key added later is written by whoever
  // owns it. Applied with SQLite's json_patch — one atomic statement, not
  // read-modify-write — where a null value removes its key (RFC 7386), which is
  // how a setting returns to the app default.
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
  'dataset:attach': {
    args: z.infer<(typeof argsSchema)['dataset:attach']>
    result: Result<DatasetPart>
  }
  'document:pick': {
    args: z.infer<(typeof argsSchema)['document:pick']>
    result: Result<DatasetRef | null>
  }
  'document:attach': {
    args: z.infer<(typeof argsSchema)['document:attach']>
    result: Result<DocumentPart>
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
  'ai:loaded': {
    args: z.infer<(typeof argsSchema)['ai:loaded']>
    result: Result<LoadedModel[]>
  }
  'ai:unload': {
    args: z.infer<(typeof argsSchema)['ai:unload']>
    result: Result<void>
  }
  'ai:chat': {
    args: z.infer<(typeof argsSchema)['ai:chat']>
    result: Result<ChatReply>
  }
  // No conversation channel returns Result, by decision: Result is for failures
  // the UI must REACT to (file missing, service down, cancelled). An indexed
  // insert into a local SQLite file has none — what is left is programming
  // defect, which must throw. Absence is data instead: an empty list, and an
  // append to a conversation that is gone is dropped (see handlers).
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
    /** Reads, hashes and stores `path` once (D16.6), returning the resulting message part. */
    attach(path: string, jobId: JobId): Promise<Result<DatasetPart>>
  }
  document: {
    pick(): Promise<Result<DatasetRef | null>>
    /** Reads, extracts and stores `path` once (D17.2), returning the resulting message part. */
    attach(path: string, jobId: JobId): Promise<Result<DocumentPart>>
  }
  job: {
    cancel(jobId: JobId): Promise<void>
    onEvent(cb: (event: JobEvent) => void): () => void
  }
  ai: {
    isAvailable(service: AiService): Promise<Result<AiAvailability>>
    /** The installed models, with capabilities and context ceiling (D15.1). */
    models(service: AiService): Promise<Result<AiModel[]>>
    /** What the provider is holding in memory right now. */
    loaded(service: AiService): Promise<Result<LoadedModel[]>>
    /** Asks the provider to drop one model's weights now. */
    unload(service: AiService, model: string): Promise<Result<void>>
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
