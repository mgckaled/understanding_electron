import { app, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import { handle } from './registry'
import { getAppInfo } from '../features/app/handlers'
import { openExternal } from '../features/shell/handlers'

export function registerAll(): void {
  handle('app:info', () => getAppInfo(app.getVersion, is.dev))
  handle('shell:openExternal', (args) => openExternal(args, shell.openExternal))
}
