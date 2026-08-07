import { app, shell, dialog, BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import type { JobEvent } from '@shared/ipc'
import { JOB_EVENT_CHANNEL } from '@shared/ipc'
import { handle } from './registry'
import { getAppInfo } from '../features/app/handlers'
import { openExternal } from '../features/shell/handlers'
import { pickDataset, scanDataset } from '../features/dataset/handlers'
import { cancelJob } from '../features/job/handlers'
import { readLines } from '../features/dataset/lines'

function broadcastJobEvent(event: JobEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(JOB_EVENT_CHANNEL, event)
  }
}

export function registerAll(): void {
  handle('app:info', () => getAppInfo(app.getVersion, is.dev))
  handle('shell:openExternal', (args) => openExternal(args, shell.openExternal))
  handle('dataset:pick', (args) => pickDataset(args, dialog.showOpenDialog))
  handle('dataset:scan', (args) => scanDataset(args, readLines, broadcastJobEvent))
  handle('job:cancel', (args) => cancelJob(args))
}
