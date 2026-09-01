import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { Api, Args, Channel, JobEvent, ResultOf } from '@shared/ipc'
import { JOB_EVENT_CHANNEL } from '@shared/channels'

function invoke<C extends Channel>(channel: C, args?: Args<C>): Promise<ResultOf<C>> {
  return ipcRenderer.invoke(channel, args) as Promise<ResultOf<C>>
}

const api: Api = {
  app: {
    info: () => invoke('app:info'),
    memory: () => invoke('app:memory'),
    processes: () => invoke('app:processes'),
    ipcStats: () => invoke('app:ipcStats')
  },
  shell: { openExternal: (url) => invoke('shell:openExternal', { url }) },
  dataset: {
    pick: () => invoke('dataset:pick'),
    attach: (path, jobId) => invoke('dataset:attach', { path, jobId }),
    query: (hash, sql) => invoke('dataset:query', { hash, sql }),
    profile: (hash) => invoke('dataset:profile', { hash }),
    transform: (hash, steps) => invoke('dataset:transform', { hash, steps }),
    queueDepth: () => invoke('dataset:queueDepth'),
    engineInfo: () => invoke('dataset:engineInfo')
  },
  document: {
    pick: () => invoke('document:pick'),
    attach: (path, jobId) => invoke('document:attach', { path, jobId })
  },
  image: {
    pick: () => invoke('image:pick'),
    attach: (path, jobId) => invoke('image:attach', { path, jobId }),
    bytes: (hash) => invoke('image:bytes', { hash })
  },
  job: {
    cancel: (jobId) => invoke('job:cancel', { jobId }),
    list: () => invoke('job:list'),
    onEvent: (cb) => {
      const listener = (_event: IpcRendererEvent, payload: JobEvent): void => cb(payload)
      ipcRenderer.on(JOB_EVENT_CHANNEL, listener)
      return () => ipcRenderer.off(JOB_EVENT_CHANNEL, listener)
    }
  },
  ai: {
    isAvailable: (service) => invoke('ai:isAvailable', { service }),
    models: (service) => invoke('ai:models', { service }),
    loaded: (service) => invoke('ai:loaded', { service }),
    unload: (service, model) => invoke('ai:unload', { service, model }),
    // Live tokens surface through api.job.onEvent as 'chunk' events; this
    // resolves with the assembled reply. No new preload channel needed.
    chat: (request, jobId) => invoke('ai:chat', { ...request, jobId }),
    propose: (request, jobId) => invoke('ai:propose', { ...request, jobId })
  },
  conversation: {
    list: () => invoke('conversation:list'),
    messages: (conversationId) => invoke('conversation:messages', { conversationId }),
    create: (conversation) => invoke('conversation:create', conversation),
    rename: (id, title) => invoke('conversation:rename', { id, title }),
    remove: (id) => invoke('conversation:remove', { id }),
    removeMessage: (conversationId, messageId) =>
      invoke('conversation:removeMessage', { conversationId, messageId }),
    append: (conversationId, message, title) =>
      invoke('conversation:append', { conversationId, message, title }),
    updateSettings: (id, patch) => invoke('conversation:settings', { id, patch })
  },
  export: {
    save: (args) => invoke('export:save', args)
  },
  draft: {
    list: (conversationId) => invoke('draft:list', { conversationId }),
    create: (draft) => invoke('draft:create', draft),
    update: (draft) => invoke('draft:update', draft),
    remove: (id) => invoke('draft:remove', { id })
  },
  settings: {
    read: () => invoke('settings:read'),
    write: (patch) => invoke('settings:write', patch)
  },
  secrets: {
    write: (provider, apiKey) => invoke('secrets:write', { provider, apiKey }),
    has: (provider) => invoke('secrets:has', { provider }),
    remove: (provider) => invoke('secrets:remove', { provider })
  },
  database: { info: () => invoke('database:info') },
  session: {
    cacheSize: () => invoke('session:cacheSize'),
    clearCache: () => invoke('session:clearCache')
  },
  disk: { usage: (jobId) => invoke('disk:usage', { jobId }) },
  events: { list: () => invoke('events:list') },
  performance: { list: () => invoke('performance:list') },
  privacy: { list: () => invoke('privacy:list') }
}

try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error(error)
}
