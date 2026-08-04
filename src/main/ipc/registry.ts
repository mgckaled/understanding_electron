import { ipcMain } from 'electron'
import { argsSchema, type Args, type Channel, type ResultOf } from '@shared/ipc'

export function handle<C extends Channel>(
  channel: C,
  fn: (args: Args<C>) => Promise<ResultOf<C>> | ResultOf<C>
): void {
  ipcMain.handle(channel, async (_event, raw: unknown) => {
    const parsed = argsSchema[channel].safeParse(raw)
    if (!parsed.success) {
      throw new Error(`IPC ${channel}: payload inválido — ${parsed.error.message}`)
    }
    return fn(parsed.data as Args<C>)
  })
}
