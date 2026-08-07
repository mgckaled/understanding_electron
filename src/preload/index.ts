import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { Api, Args, Channel, JobEvent, ResultOf } from '@shared/ipc'
import { JOB_EVENT_CHANNEL } from '@shared/ipc'

function invoke<C extends Channel>(channel: C, args?: Args<C>): Promise<ResultOf<C>> {
  return ipcRenderer.invoke(channel, args) as Promise<ResultOf<C>>
}

const api: Api = {
  app: {
    info: () => invoke('app:info')
  },
  shell: {
    openExternal: (url) => invoke('shell:openExternal', { url })
  },
  dataset: {
    pick: () => invoke('dataset:pick'),
    scan: (path, jobId) => invoke('dataset:scan', { path, jobId })
  },
  job: {
    cancel: (jobId) => invoke('job:cancel', { jobId }),
    onEvent: (cb) => {
      const listener = (_event: IpcRendererEvent, payload: JobEvent): void => cb(payload)
      ipcRenderer.on(JOB_EVENT_CHANNEL, listener)
      return () => ipcRenderer.off(JOB_EVENT_CHANNEL, listener)
    }
  }
}

try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error(error)
}
