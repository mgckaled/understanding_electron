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

test('attaches a file, shows it pending, then discards it via the chip', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/sample.csv')

  await electronApp.evaluate(
    ({ dialog }, filePaths) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths })
    },
    [fixturePath]
  )

  // The trigger stays the composer's clip (DS5, item 7) — what it produces
  // now rides the message instead of dying in the popover (plano 16). The
  // popover closes itself before the native dialog opens (DS5.5).
  await page.getByRole('button', { name: 'Anexar arquivo' }).click()
  await page.getByRole('button', { name: 'Escolher arquivo' }).click()

  // The chip lives OUTSIDE the popover, visible without reopening it —
  // D16.6: "fica pendente no composer, como o rascunho".
  await expect(page.getByText('sample.csv')).toBeVisible()

  // Reopening the clip shows the schema that was scanned alongside the hash.
  await page.getByRole('button', { name: 'Anexar arquivo' }).click()
  await expect(page.getByText('id, name, city')).toBeVisible()
  await expect(page.getByText('2', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Anexar arquivo' }).click() // close again

  // The chip's own × discards the pending attachment without opening anything.
  await page.getByRole('button', { name: 'Remover anexo' }).click()
  await expect(page.getByText('sample.csv')).not.toBeVisible()
})
