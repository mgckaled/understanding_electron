import type { AppInfo } from '@shared/ipc'

export function getAppInfo(getVersion: () => string, isDev: boolean): AppInfo {
  return {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    app: getVersion(),
    platform: process.platform,
    isDev
  }
}
