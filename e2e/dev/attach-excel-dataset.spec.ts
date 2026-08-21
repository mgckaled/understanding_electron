import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { join } from 'node:path'
import { tableFromIPC } from 'apache-arrow'
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

// The real item of plano 18-F passo 5 (D18F.6): "the four components don't
// change" is not the same as "it's proven" — read_xlsx infers DATE/TIMESTAMP/
// BOOLEAN from the source cell's own Excel formatting (Context7), a path
// normalizeColumns.ts (18-B) never saw coming from a .xlsx. sample.xlsx
// covers the same seven types attach-json-dataset.spec.ts already proved for
// JSON, written by DuckDB's own `COPY ... TO FORMAT xlsx` (real cell
// formatting, not text-that-looks-like-a-date), exercised through the real
// Electron IPC boundary end to end.
test('attaches a real Excel workbook, queries and profiles it through the real IPC boundary', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/sample.xlsx')

  const attached = await page.evaluate(async (path) => {
    const api = (window as unknown as { api: Api }).api
    const result = await api.dataset.attach(path, 'e2e-excel-attach')
    if (!result.ok) throw new Error(`attach failed: ${JSON.stringify(result.error)}`)
    return result.value
  }, fixturePath)

  expect(attached.format).toBe('excel')
  expect(attached.columns).toEqual(['id', 'price', 'name', 'born', 'created_at', 'active', 'note'])
  expect(attached.rowCount).toBe(3)

  const bytes = await page.evaluate(async (hash) => {
    const api = (window as unknown as { api: Api }).api
    const result = await api.dataset.query(hash, 'SELECT * FROM dataset ORDER BY id')
    if (!result.ok) throw new Error(`query failed: ${JSON.stringify(result.error)}`)
    return Array.from(result.value)
  }, attached.hash)

  const table = tableFromIPC(new Uint8Array(bytes))
  const rows = [...table].map((row) => row.toArray())

  // id comes back as DOUBLE (a plain `number`), not BIGINT (a `bigint`) —
  // live-confirmed via DESCRIBE against this same fixture: read_xlsx types a
  // numeric Excel cell from its formatting, and an unformatted whole number
  // has no "this is an integer" signal the way a JSON number literal or a
  // CSV column of digits does. Same class as Risco 5 (a date stored as a raw
  // serial reads as DOUBLE too) — the source file's ambiguity, not a
  // normalizeColumns.ts gap: DOUBLE is already exercised by every delimited
  // dataset with a decimal column.
  expect(rows).toEqual([
    [1, 19.9, 'Caneta', Date.UTC(2024, 0, 15), Date.UTC(2024, 0, 15, 14, 30, 0), true, 'ok'],
    [2, 149.5, 'Teclado', Date.UTC(2024, 2, 2), Date.UTC(2024, 2, 2, 9, 5, 12), false, null],
    [3, 899, 'Monitor', Date.UTC(2024, 5, 20), Date.UTC(2024, 5, 20, 23, 59, 59), true, 'promo']
  ])

  const profile = await page.evaluate(async (hash) => {
    const api = (window as unknown as { api: Api }).api
    const result = await api.dataset.profile(hash)
    if (!result.ok) throw new Error(`profile failed: ${JSON.stringify(result.error)}`)
    return result.value
  }, attached.hash)

  expect(profile.map((column) => column.column)).toEqual([
    'id',
    'price',
    'name',
    'born',
    'created_at',
    'active',
    'note'
  ])
  const note = profile.find((column) => column.column === 'note')
  expect(note?.nullPercentage).toBeCloseTo((1 / 3) * 100, 0)
  const price = profile.find((column) => column.column === 'price')
  expect(price?.avg).not.toBeNull()
  expect(Number.isNaN(price?.avg)).toBe(false)
})

// D18F.6 — the UI-level branch: mirrors attach-json-dataset.spec.ts's own
// working pattern — "Formato: Excel" where a delimited attach would show
// "Separador" and a JSON one would show "Formato: JSON".
test('shows the Excel schema and "Formato: Excel" in the composer\'s pending popover', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/sample.xlsx')

  await electronApp.evaluate(
    ({ dialog }, filePaths) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths })
    },
    [fixturePath]
  )

  await page.getByRole('button', { name: 'Adicionar anexo' }).click()
  await page.getByRole('button', { name: 'Dados tabulares' }).click()

  await expect(page.getByText('sample.xlsx')).toBeVisible()

  await page.getByRole('button', { name: 'Adicionar anexo' }).click()
  await expect(page.getByText('id, price, name, born, created_at, active, note')).toBeVisible()
  await expect(page.getByText('Formato')).toBeVisible()
  await expect(page.getByText('Excel', { exact: true })).toBeVisible()
  await expect(page.getByText('Separador')).not.toBeVisible()
})

// Risco 3 (18-F) — live-confirmed this contradicts the Context7 doc, which
// says the first sheet loads when `sheet` is omitted (excel_import.md):
// against this fixture (built by two sequential `COPY ... TO ... FORMAT
// xlsx` calls, Sheet1 then Sheet2, to the same file), read_xlsx with no
// `sheet` returned Sheet2's row, not Sheet1's. A caveat this test cannot
// rule out: DuckDB's own xlsx *writer* may mark the last-written sheet
// "active", and it may be that attribute — not sheet position — that
// read_xlsx follows; a workbook authored in real Excel could differ.
// Observed only, not decided (D18F above) — a fixture with two sheets,
// Sheet1 (id=1, "from Sheet1") and Sheet2 (id=2, "from Sheet2").
test('observes which sheet is read when a workbook has more than one and no sheet is given', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/duas-planilhas.xlsx')

  const attached = await page.evaluate(async (path) => {
    const api = (window as unknown as { api: Api }).api
    const result = await api.dataset.attach(path, 'e2e-excel-two-sheets')
    if (!result.ok) throw new Error(`attach failed: ${JSON.stringify(result.error)}`)
    return result.value
  }, fixturePath)

  const bytes = await page.evaluate(async (hash) => {
    const api = (window as unknown as { api: Api }).api
    const result = await api.dataset.query(hash, 'SELECT * FROM dataset')
    if (!result.ok) throw new Error(`query failed: ${JSON.stringify(result.error)}`)
    return Array.from(result.value)
  }, attached.hash)

  const table = tableFromIPC(new Uint8Array(bytes))
  const rows = [...table].map((row) => row.toArray())

  // Observation, not an assertion: the plan explicitly does not decide
  // "which sheet", only records what happens.
  console.log('[18-F Risco 3] rows read from workbook with no explicit sheet:', rows)
  expect(rows.length).toBeGreaterThan(0)
})
