import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'

let electronApp: ElectronApplication
let page: Page

test.beforeAll(async () => {
  electronApp = await electron.launch({ args: ['.'] })
  page = await electronApp.firstWindow()
})

test.afterAll(async () => {
  await electronApp.close()
})

test('the window opens with the expected title', async () => {
  expect(await page.title()).toBe('crivo')
})

test('#root has content', async () => {
  const root = page.locator('#root')
  await expect(root).not.toBeEmpty()
})
