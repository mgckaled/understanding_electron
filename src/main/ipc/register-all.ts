import { join } from 'node:path'
import { app, shell, dialog, nativeTheme, safeStorage, BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import type { JobEvent } from '@shared/ipc'
import { JOB_EVENT_CHANNEL } from '@shared/channels'
import { handle } from './registry'
import { DATABASE_FILE, openDatabase } from '../db/open'
import { freemem, totalmem } from 'node:os'
import { getAppInfo, getSystemMemory } from '../features/app/handlers'
import { openExternal } from '../features/shell/handlers'
import { attachDataset, queryDataset, profileDataset } from '../features/dataset/handlers'
import { pickDataset } from '../features/dataset/pick'
import { pickDocument, attachDocument } from '../features/document/handlers'
import { pickImage, attachImage } from '../features/image/handlers'
import { cancelJob } from '../features/job/handlers'
import { readHashedFile, hashOnlyFile, sniffFileFormat } from '../features/dataset/lines'
import { readDocumentFile, statDocumentSize } from '../features/document/readFile'
import { readImageFile } from '../features/image/readFile'
import { rasterizeToPng } from '../image/rasterize'
import { ensureAttachment, ensureAttachmentBytes } from '../attachments/storage'
import { handleAttachmentProtocol } from '../attachments/protocol'
import { resolveAttachmentBytes } from '../attachments/readBytes'
import { collectOrphanedAttachments } from '../attachments/gc'
import {
  chat as aiChat,
  isAvailable as aiIsAvailable,
  loaded as aiLoaded,
  models as aiModels,
  unload as aiUnload
} from '../features/ai/handlers'
import {
  ollamaChat,
  ollamaDisplayHost,
  ollamaLoaded,
  ollamaModels,
  ollamaProbe,
  ollamaUnload
} from '../features/ai/providers/ollama'
import {
  appendMessage,
  createConversation,
  listConversations,
  readMessages,
  removeConversation,
  renameConversation,
  updateConversationSettings
} from '../features/conversation/handlers'
import { readSettings, writeSettings } from '../features/settings/handlers'
import { hasSecret, removeSecret, writeSecret } from '../features/secrets/handlers'
import { seedSecretsFromEnv } from '../features/secrets/seed'
import { spawnDuckdbWorker, createDuckdbWorkerClient } from '../duckdb/spawnWorker'

// getSelectedStorageBackend() only exists on Linux (Electron's own binding is
// under #if BUILDFLAG(IS_LINUX)) — calling it on win32/macOS throws. null
// there is not "unknown", it is "this platform has no such concept"
// (DN1A.4, core/ai/secrets.ts).
function readSecretBackendInfo(): { encryptionAvailable: boolean; backend: string | null } {
  return {
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
    backend: process.platform === 'linux' ? safeStorage.getSelectedStorageBackend() : null
  }
}

// safeStorage.encryptString is a native method — passing the bare property
// (safeStorage.encryptString) detaches it from its `this`, and Electron's
// binding throws "Illegal invocation" when called that way. Measured live
// (pnpm dev): the seed's UnhandledPromiseRejectionWarning is what caught it.
function encryptSecret(plainText: string): Uint8Array {
  return safeStorage.encryptString(plainText)
}

function broadcastJobEvent(event: JobEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(JOB_EVENT_CHANNEL, event)
  }
}

/**
 * Wires every channel and returns the shutdown it owns. The database opens here
 * because this is the composition root — the only place allowed to know the file
 * lives under app.getPath('userData'). It hands back `close` so main/index.ts
 * keeps the lifecycle; a clean close folds -wal and -shm back into crivo.db.
 *
 * Awaited by main/index.ts before createWindow(): the startup sweep below must
 * finish before a renderer can exist to race it with a fresh dataset:attach.
 */
export async function registerAll(): Promise<() => void> {
  const db = openDatabase(join(app.getPath('userData'), DATABASE_FILE))
  const attachmentsDir = join(app.getPath('userData'), 'attachments')
  // Resolved once, here, where app.isPackaged/process.resourcesPath are known
  // terrain (icon.png already reads process.resourcesPath the same way) —
  // the worker never imports electron, so it cannot resolve this itself
  // (D18F.2). asarUnpack: resources/** (electron-builder.yml) is what makes
  // the packaged path exist on disk instead of inside app.asar.
  const excelExtensionPath = app.isPackaged
    ? join(
        process.resourcesPath,
        'app.asar.unpacked',
        'resources',
        'duckdb-extensions',
        'excel.duckdb_extension'
      )
    : join(app.getAppPath(), 'resources', 'duckdb-extensions', 'excel.duckdb_extension')
  // Spawned once, kept alive for the app's life (D18B.3-bis) — one DuckDB
  // connection, not one per query.
  const duckdbWorker = spawnDuckdbWorker(app.getPath('userData'), excelExtensionPath)
  const duckdbClient = createDuckdbWorkerClient(duckdbWorker)
  // The scheme itself is registered in main/index.ts, before app.whenReady()
  // — registerSchemesAsPrivileged only works pre-ready. Wiring the handler
  // here, where attachmentsDir already exists, keeps main/index.ts thin (D17.6).
  handleAttachmentProtocol(attachmentsDir)

  // Read once, synchronously, before any window exists to ask — the renderer's
  // own `prefers-color-scheme` already follows this once set (DS4.2), and
  // `main/index.ts` reads `nativeTheme.shouldUseDarkColors` for the same reason.
  nativeTheme.themeSource = readSettings(undefined, db).theme

  handle('app:info', () => getAppInfo(app.getVersion, is.dev))
  handle('app:memory', () => getSystemMemory(freemem, totalmem))
  handle('shell:openExternal', (args) => openExternal(args, shell.openExternal))
  handle('dataset:pick', (args) => pickDataset(args, dialog.showOpenDialog))
  handle('dataset:attach', (args) =>
    attachDataset(
      args,
      readHashedFile,
      hashOnlyFile,
      { attachmentsDir, storeAttachment: ensureAttachment },
      broadcastJobEvent,
      sniffFileFormat,
      duckdbClient.runSchema
    )
  )
  handle('dataset:query', (args) => queryDataset(args, duckdbClient.runQuery))
  handle('dataset:profile', (args) => profileDataset(args, duckdbClient.runProfile))
  handle('document:pick', (args) => pickDocument(args, dialog.showOpenDialog, statDocumentSize))
  handle('document:attach', (args) =>
    attachDocument(args, readDocumentFile, attachmentsDir, ensureAttachment, broadcastJobEvent)
  )
  handle('image:pick', (args) => pickImage(args, dialog.showOpenDialog))
  handle('image:attach', (args) =>
    attachImage(
      args,
      readImageFile,
      attachmentsDir,
      ensureAttachment,
      broadcastJobEvent,
      rasterizeToPng,
      ensureAttachmentBytes
    )
  )
  handle('job:cancel', (args) => cancelJob(args))
  // Single provider in step 1 — the args.service enum admits only 'ollama'.
  // Step 3 (cloud opt-in) replaces the fixed adapters with a service→provider
  // resolver; nothing else in this file changes.
  handle('ai:isAvailable', (args) => aiIsAvailable(args, ollamaProbe, ollamaDisplayHost))
  handle('ai:models', (args) => aiModels(args, ollamaModels))
  handle('ai:loaded', (args) => aiLoaded(args, ollamaLoaded))
  handle('ai:unload', (args) => aiUnload(args, ollamaUnload))
  handle('ai:chat', (args) =>
    aiChat(args, ollamaChat, broadcastJobEvent, resolveAttachmentBytes(attachmentsDir))
  )

  handle('conversation:list', (args) => listConversations(args, db))
  handle('conversation:messages', (args) => readMessages(args, db))
  handle('conversation:create', (args) => createConversation(args, db))
  handle('conversation:rename', (args) => renameConversation(args, db))
  handle('conversation:remove', async (args) => {
    removeConversation(args, db)
    // Recomputes the GLOBAL reference set AFTER the cascade delete — a hash
    // still used by another conversation stays in it, which is what makes a
    // shared blob survive (D16.2 aceite), with no per-conversation bookkeeping.
    await collectOrphanedAttachments(db, attachmentsDir)
  })
  handle('conversation:append', (args) => appendMessage(args, db))
  handle('conversation:settings', (args) => updateConversationSettings(args, db))

  handle('settings:read', (args) => readSettings(args, db))
  handle('settings:write', (args) => {
    writeSettings(args, db)
    if (args.theme !== undefined) nativeTheme.themeSource = args.theme
  })

  handle('secrets:write', (args) => writeSecret(args, db, encryptSecret, readSecretBackendInfo()))
  handle('secrets:has', (args) => hasSecret(args, db))
  handle('secrets:remove', (args) => removeSecret(args, db))

  // Dev-only seed (DN1A.1): .env never ships (app.isPackaged guards it), and
  // it only FILLS a key that is still unset — a key already written through
  // the UI is never overwritten. try/catch because it is not confirmed
  // whether process.loadEnvFile() throws when no .env is present, which is
  // the common case (Risco 1).
  if (!app.isPackaged) {
    try {
      process.loadEnvFile()
    } catch {
      // No local .env — nothing to seed.
    }
    seedSecretsFromEnv(db, process.env, encryptSecret, readSecretBackendInfo())
  }

  // Startup sweep (D16.2): closes the gap a removal event cannot reach — an
  // attach that succeeded and was discarded before ever being sent. Awaited,
  // not fire-and-forget: it must finish before a window can exist to race it
  // with a fresh dataset:attach that has not been appended yet.
  await collectOrphanedAttachments(db, attachmentsDir).catch(() => {})

  return () => {
    db.close()
    duckdbWorker.kill()
  }
}
