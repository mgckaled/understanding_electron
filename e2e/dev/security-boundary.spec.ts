import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import type { Api } from '@shared/ipc'

let electronApp: ElectronApplication
let page: Page

test.beforeAll(async () => {
  electronApp = await electron.launch({ args: ['.'] })
  page = await electronApp.firstWindow()
})

test.afterAll(async () => {
  await electronApp.close()
})

test('exposes window.api and nothing beyond it', async () => {
  const result = await page.evaluate(() => {
    const untypedWindow = window as unknown as {
      api?: Api
      electron?: unknown
      require?: unknown
      process?: unknown
    }
    return {
      apiType: typeof untypedWindow.api,
      electron: untypedWindow.electron,
      requireFn: untypedWindow.require,
      process: untypedWindow.process,
      apiKeys: untypedWindow.api ? Object.keys(untypedWindow.api).sort() : []
    }
  })

  expect(result.apiType).toBe('object')
  expect(result.electron).toBeUndefined()
  expect(result.requireFn).toBeUndefined()
  expect(result.process).toBeUndefined()
  // An exact list, not a subset: the point is that a new key has to be added
  // here on purpose. A surface that grows silently is the one contextIsolation
  // exists to keep narrow.
  expect(result.apiKeys).toEqual(['ai', 'app', 'conversation', 'dataset', 'job', 'shell'])
})
