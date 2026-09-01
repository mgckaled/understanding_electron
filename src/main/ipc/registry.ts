import { ipcMain } from 'electron'
import { argsSchema, type Args, type AppIpcStat, type Channel, type ResultOf } from '@shared/ipc'
import { createIpcStatsStore } from '@core/observatory/ipcStats'
import type { IpcCallEvent } from '@core/observatory/events'

const ipcStats = createIpcStatsStore()

/** O-6: registerAll() calls this once, wiring completed calls to observatory.db. */
export function configureEventSink(sink: (event: IpcCallEvent) => void): void {
  ipcStats.setEventSink(sink)
}

/**
 * Wraps `fn` after schema validation, so a client sending garbage never
 * reaches the counter — that failure is a bug on the caller's side, not a
 * handler health signal (DO2.8).
 */
export function handle<C extends Channel>(
  channel: C,
  fn: (args: Args<C>) => Promise<ResultOf<C>> | ResultOf<C>
): void {
  const wrapped = ipcStats.wrap(channel, fn)
  ipcMain.handle(channel, async (_event, raw: unknown) => {
    const parsed = argsSchema[channel].safeParse(raw)
    if (!parsed.success) {
      throw new Error(`IPC ${channel}: payload inválido — ${parsed.error.message}`)
    }
    return wrapped(parsed.data as Args<C>)
  })
}

export function getIpcStats(): AppIpcStat[] {
  return ipcStats.snapshot()
}
