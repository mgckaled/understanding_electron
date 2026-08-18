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

  // The trigger became a categories popover in plano 17 (Dados tabulares /
  // Documentos / Imagens / Código) — picking a category closes the popover
  // and opens the native dialog itself (DS5.5), no separate confirm click.
  await page.getByRole('button', { name: 'Adicionar anexo' }).click()
  await page.getByRole('button', { name: 'Dados tabulares' }).click()

  // The chip lives OUTSIDE the popover, visible without reopening it —
  // D16.6: "fica pendente no composer, como o rascunho".
  await expect(page.getByText('sample.csv')).toBeVisible()

  // Reopening the trigger with a pending attachment shows the scanned schema
  // instead of the categories list (AttachButton's other popover branch).
  await page.getByRole('button', { name: 'Adicionar anexo' }).click()
  await expect(page.getByText('id, name, city')).toBeVisible()
  await expect(page.getByText('2', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Adicionar anexo' }).click() // close again

  // The chip's own × discards the pending attachment without opening anything.
  await page.getByRole('button', { name: 'Remover anexo' }).click()
  await expect(page.getByText('sample.csv')).not.toBeVisible()
})
