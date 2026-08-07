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

// job:event is not an invoke/handle channel — ipcMain never `.handle()`s it,
// so it has no entry in argsSchema/IpcContract. main broadcasts JobEvent
// payloads through it and preload subscribes with ipcRenderer.on. The
// constant is what keeps main and preload from drifting on the channel name.
export const JOB_EVENT_CHANNEL = 'job:event'

export const argsSchema = {
  'app:info': z.void(),
  'shell:openExternal': z.object({ url: z.string().url() }),
  'dataset:pick': z.void(),
  'dataset:scan': z.object({ path: z.string(), jobId: z.string() }),
  'job:cancel': z.object({ jobId: z.string() })
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
}
