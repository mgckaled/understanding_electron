import { join } from 'node:path'
import { app, shell, dialog, BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import type { JobEvent } from '@shared/ipc'
import { JOB_EVENT_CHANNEL } from '@shared/channels'
import { handle } from './registry'
import { DATABASE_FILE, openDatabase } from '../db/open'
import { getAppInfo } from '../features/app/handlers'
import { openExternal } from '../features/shell/handlers'
import { pickDataset, scanDataset } from '../features/dataset/handlers'
import { cancelJob } from '../features/job/handlers'
import { readLines } from '../features/dataset/lines'
import { chat as aiChat, isAvailable as aiIsAvailable } from '../features/ai/handlers'
import { ollamaChat, ollamaProbe } from '../features/ai/providers/ollama'
import {
  appendMessage,
  createConversation,
  listConversations,
  readMessages,
  removeConversation,
  renameConversation
} from '../features/conversation/handlers'
import { readSettings, writeSettings } from '../features/settings/handlers'

function broadcastJobEvent(event: JobEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(JOB_EVENT_CHANNEL, event)
  }
}

/**
 * Wires every channel and returns the shutdown it owns.
 *
 * The database is opened here because this is the composition root — the only
 * place allowed to know that the file lives under app.getPath('userData'). It
 * hands back `close` instead of closing itself on some event, so main/index.ts
 * keeps the lifecycle and this file keeps the wiring. Closing matters: a clean
 * close folds the -wal and -shm files back into crivo.db.
 */
export function registerAll(): () => void {
  const db = openDatabase(join(app.getPath('userData'), DATABASE_FILE))

  handle('app:info', () => getAppInfo(app.getVersion, is.dev))
  handle('shell:openExternal', (args) => openExternal(args, shell.openExternal))
  handle('dataset:pick', (args) => pickDataset(args, dialog.showOpenDialog))
  handle('dataset:scan', (args) => scanDataset(args, readLines, broadcastJobEvent))
  handle('job:cancel', (args) => cancelJob(args))
  // Single provider in step 1 — the args.service enum admits only 'ollama'.
  // Step 3 (cloud opt-in) replaces the fixed adapters with a service→provider
  // resolver; nothing else in this file changes.
  handle('ai:isAvailable', (args) => aiIsAvailable(args, ollamaProbe))
  handle('ai:chat', (args) => aiChat(args, ollamaChat, broadcastJobEvent))

  handle('conversation:list', (args) => listConversations(args, db))
  handle('conversation:messages', (args) => readMessages(args, db))
  handle('conversation:create', (args) => createConversation(args, db))
  handle('conversation:rename', (args) => renameConversation(args, db))
  handle('conversation:remove', (args) => removeConversation(args, db))
  handle('conversation:append', (args) => appendMessage(args, db))

  handle('settings:read', (args) => readSettings(args, db))
  handle('settings:write', (args) => writeSettings(args, db))

  return () => db.close()
}
