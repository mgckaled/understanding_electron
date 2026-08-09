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
// No zod schema and no channel on purpose: a schema exists to validate an IPC
// payload, and there is no IPC here yet. Both are born in plano 14, together.
export type MessagePart = { kind: 'text'; text: string }

export type MessageRole = 'user' | 'assistant'

export type Message = {
  id: string
  role: MessageRole
  parts: MessagePart[]
  createdAt: number
  // The model that produced this message, recorded per message and not only
  // per conversation (D13.4). The model is deliberately NOT locked after the
  // first reply — on a local-model app "this 4B failed, move up to qwen 7B" is
  // the main recovery action — so a transcript can carry mixed authorship.
  // That is resolved with data, not with a prohibition.
  model?: string
}

export type Conversation = {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

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
  })
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
}
