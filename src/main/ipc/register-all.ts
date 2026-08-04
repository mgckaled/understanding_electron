import { handle } from './registry'
import { getAppInfo } from '../features/app/handlers'
import { openExternal } from '../features/shell/handlers'

export function registerAll(): void {
  handle('app:info', () => getAppInfo())
  handle('shell:openExternal', (args) => openExternal(args))
}
