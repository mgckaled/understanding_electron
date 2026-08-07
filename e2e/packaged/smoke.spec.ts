import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { findLatestBuild, parseElectronApp } from 'electron-playwright-helpers'

let electronApp: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const latestBuild = findLatestBuild('dist')
  const appInfo = parseElectronApp(latestBuild)
  electronApp = await electron.launch({
    args: [appInfo.main],
    executablePath: appInfo.executable
  })
  page = await electronApp.firstWindow()
})

test.afterAll(async () => {
  await electronApp.close()
})

test('the packaged app opens and exposes window.api', async () => {
  await expect(page.locator('#root')).not.toBeEmpty()

  const apiType = await page.evaluate(() => typeof (window as unknown as { api?: unknown }).api)
  expect(apiType).toBe('object')
})
