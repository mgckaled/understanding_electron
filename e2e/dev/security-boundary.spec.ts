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
  expect(result.apiKeys).toEqual(['ai', 'app', 'dataset', 'job', 'shell'])
})
