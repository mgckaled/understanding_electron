import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { APP_ID } from '@shared/meta'
import { checkExternalUrl } from '@core/url'
import { registerAll } from './ipc/register-all'
import icon from '../../resources/icon.png?asset'

/**
 * The only way this process hands a URL to the OS. Both callers below used to
 * call `shell.openExternal` directly, bypassing the scheme allow-list that the
 * `shell:openExternal` IPC channel enforces — the protection existed and was
 * tested, but not on the paths that a page could actually reach.
 */
function openExternalIfAllowed(url: string): void {
  const checked = checkExternalUrl(url)
  if (checked.ok) void shell.openExternal(checked.value)
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#16171a', // must match --color-bg in shared/ui/tokens.css (dark theme)
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true, // renderer runs inside the Chromium sandbox
      contextIsolation: true, // default — spelled out because it is a security boundary
      nodeIntegration: false // idem
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    openExternalIfAllowed(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed =
      is.dev && process.env['ELECTRON_RENDERER_URL']
        ? new URL(url).origin === new URL(process.env['ELECTRON_RENDERER_URL']).origin
        : false
    if (!allowed) {
      event.preventDefault()
      openExternalIfAllowed(url)
    }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId(APP_ID)

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Closing on the way out folds the -wal and -shm files back into crivo.db.
  const closeDatabase = registerAll()
  app.on('will-quit', closeDatabase)

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
