import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import type { AppInfo } from '@shared/ipc'

export function getAppInfo(): AppInfo {
  return {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    app: app.getVersion(),
    platform: process.platform,
    isDev: is.dev
  }
}
