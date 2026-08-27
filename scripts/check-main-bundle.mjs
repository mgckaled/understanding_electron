import { createRequire } from 'node:module'
import Module from 'node:module'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Loads the BUILT main bundle with `electron` stubbed, which is the one thing
// typecheck, lint and vitest cannot do: they all run the source under ESM, and
// the bundle is CJS with dependencies left external. An ESM-only package lands
// there as `{ default }` instead of the function it exports, and the app dies
// at load with no other signal (DE1D.9).

// Absolute, from the working directory: createRequire resolves relative
// paths against this script's folder, not against where pnpm ran.
const BUNDLE = resolve(process.cwd(), 'out/main/index.js')

if (!existsSync(BUNDLE)) {
  console.error('Nada para checar: rode `pnpm build` antes.')
  process.exit(1)
}

const noop = () => undefined
const stub = {
  app: {
    on: noop,
    whenReady: () => new Promise(() => {}),
    getPath: () => '.',
    setPath: noop,
    requestSingleInstanceLock: () => true
  },
  BrowserWindow: class {
    static getAllWindows() {
      return []
    }
  },
  ipcMain: { handle: noop },
  shell: {},
  dialog: {},
  nativeTheme: {},
  safeStorage: {},
  protocol: { handle: noop, registerSchemesAsPrivileged: noop },
  utilityProcess: { fork: noop },
  net: {}
}

const load = Module._load
Module._load = function (request, ...rest) {
  return request === 'electron' ? stub : load.call(this, request, ...rest)
}

try {
  createRequire(import.meta.url)(BUNDLE)
  console.log('main bundle: carrega')
} catch (error) {
  console.error('main bundle NAO carrega:', error.message)
  process.exit(1)
}
