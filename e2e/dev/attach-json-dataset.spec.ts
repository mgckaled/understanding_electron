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

// The real item of plano 18-E passo 5 (D18E.6): "the four components don't
// change" is not the same as "it's proven" — read_json_auto can infer
// TIMESTAMP from an ISO datetime string, a type normalizeColumns.ts (18-B)
// never saw coming from the CSV path. sample.ndjson covers the six types
// arrow.test.ts already tests (BIGINT, DOUBLE, VARCHAR, DATE, BOOLEAN, a
// nullable column) plus a seventh, TIMESTAMP, exercised through the real
// Electron IPC boundary end to end.
test('attaches a real NDJSON, queries and profiles it through the real IPC boundary', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/sample.ndjson')

  const attached = await page.evaluate(async (path) => {
    const api = (window as unknown as { api: Api }).api
    const result = await api.dataset.attach(path, 'e2e-json-attach')
    if (!result.ok) throw new Error(`attach failed: ${JSON.stringify(result.error)}`)
    return result.value
  }, fixturePath)

  expect(attached.format).toBe('json')
  expect(attached.columns).toEqual([
    'id',
    'preco',
    'nome',
    'nascimento',
    'ativo',
    'observacao',
    'criado_em'
  ])
  expect(attached.rowCount).toBe(3)

  const bytes = await page.evaluate(async (hash) => {
    const api = (window as unknown as { api: Api }).api
    const result = await api.dataset.query(hash, 'SELECT * FROM dataset ORDER BY id')
    if (!result.ok) throw new Error(`query failed: ${JSON.stringify(result.error)}`)
    return Array.from(result.value)
  }, attached.hash)

  const table = tableFromIPC(new Uint8Array(bytes))
  const rows = [...table].map((row) => row.toArray())

  expect(rows).toEqual([
    [
      1n,
      19.9,
      'Ana',
      Date.UTC(1990, 4, 20),
      true,
      'cliente antigo',
      Date.UTC(2026, 7, 21, 10, 30, 0)
    ],
    [2n, 45.5, 'Bruno', Date.UTC(1985, 10, 2), false, null, Date.UTC(2026, 7, 20, 9, 0, 0)],
    [3n, 7.25, 'Carla', Date.UTC(2001, 0, 15), true, null, Date.UTC(2026, 7, 19, 14, 45, 30)]
  ])

  const profile = await page.evaluate(async (hash) => {
    const api = (window as unknown as { api: Api }).api
    const result = await api.dataset.profile(hash)
    if (!result.ok) throw new Error(`profile failed: ${JSON.stringify(result.error)}`)
    return result.value
  }, attached.hash)

  expect(profile.map((column) => column.column)).toEqual([
    'id',
    'preco',
    'nome',
    'nascimento',
    'ativo',
    'observacao',
    'criado_em'
  ])
  const observacao = profile.find((column) => column.column === 'observacao')
  expect(observacao?.nullPercentage).toBeCloseTo((2 / 3) * 100, 0)
})

// D18E.4 — the engine happily types a nested value (STRUCT), so the refusal
// is this app's, surfaced before the part ever becomes a DatasetPart.
test('refuses a JSON dataset with a nested object column, naming it', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/aninhado.json')

  const error = await page.evaluate(async (path) => {
    const api = (window as unknown as { api: Api }).api
    const result = await api.dataset.attach(path, 'e2e-json-nested')
    return result.ok ? null : result.error
  }, fixturePath)

  expect(error?.kind).toBe('blocked')
  expect((error as { kind: 'blocked'; reason: string }).reason).toMatch(/endereco/)
})

// UI-level: mirrors attach-dataset.spec.ts's own working pattern — the
// composer's pending-attachment popover shows the scanned schema, not yet
// the message-card preview (that only exists once sent). D18E.6's own line:
// "Formato: JSON" where a delimited attach would show "Separador".
test('shows the JSON schema and "Formato: JSON" in the composer\'s pending popover', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/sample.ndjson')

  await electronApp.evaluate(
    ({ dialog }, filePaths) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths })
    },
    [fixturePath]
  )

  await page.getByRole('button', { name: 'Adicionar anexo' }).click()
  await page.getByRole('button', { name: 'Dados tabulares' }).click()

  await expect(page.getByText('sample.ndjson')).toBeVisible()

  await page.getByRole('button', { name: 'Adicionar anexo' }).click()
  await expect(
    page.getByText('id, preco, nome, nascimento, ativo, observacao, criado_em')
  ).toBeVisible()
  await expect(page.getByText('Formato')).toBeVisible()
  await expect(page.getByText('JSON', { exact: true })).toBeVisible()
  await expect(page.getByText('Separador')).not.toBeVisible()
})
