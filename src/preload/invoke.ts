import { ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { Args, Channel, JobEvent, ResultOf } from '@shared/ipc'
import { JOB_EVENT_CHANNEL } from '@shared/channels'

// The channel name is a VALUE, so it comes from shared/channels.ts and never
// from shared/ipc.ts: that one imports zod as a value for argsSchema, and a
// sandboxed preload has no require to resolve it — the window would open empty
// with nothing in the terminal (skill `ipc`).

/** Sends one typed request, resolving with the channel's declared result. */
export function invoke<C extends Channel>(channel: C, args?: Args<C>): Promise<ResultOf<C>> {
  return ipcRenderer.invoke(channel, args) as Promise<ResultOf<C>>
}

/**
 * Subscribes to job progress, returning the function that unsubscribes.
 *
 * @param callback - Receives the payload alone; the IpcRendererEvent stays here
 *   because it carries `sender`, a live reference to the webContents.
 */
export function onJobEvent(callback: (event: JobEvent) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: JobEvent): void => callback(payload)
  ipcRenderer.on(JOB_EVENT_CHANNEL, listener)
  return () => ipcRenderer.off(JOB_EVENT_CHANNEL, listener)
}
