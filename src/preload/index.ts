import { contextBridge, ipcRenderer } from 'electron'
import type { Api, Args, Channel, ResultOf } from '@shared/ipc'

function invoke<C extends Channel>(channel: C, args?: Args<C>): Promise<ResultOf<C>> {
  return ipcRenderer.invoke(channel, args) as Promise<ResultOf<C>>
}

const api: Api = {
  app: {
    info: () => invoke('app:info')
  },
  shell: {
    openExternal: (url) => invoke('shell:openExternal', { url })
  }
}

try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error(error)
}
