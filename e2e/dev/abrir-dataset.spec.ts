import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { join } from 'node:path'

let electronApp: ElectronApplication
let page: Page

test.beforeAll(async () => {
  electronApp = await electron.launch({ args: ['.'] })
  page = await electronApp.firstWindow()
})

test.afterAll(async () => {
  await electronApp.close()
})

test('picks a file and shows the scan summary', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/sample.csv')

  await electronApp.evaluate(
    ({ dialog }, filePaths) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths })
    },
    [fixturePath]
  )

  await page.getByRole('button', { name: 'Escolher arquivo' }).click()

  await expect(page.getByText('id, name, city')).toBeVisible()
  await expect(page.getByText('2', { exact: true })).toBeVisible()
})
