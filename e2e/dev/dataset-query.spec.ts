import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { join } from 'node:path'
import { tableFromIPC } from 'apache-arrow'
import type { Api, AppError } from '@shared/ipc'

let electronApp: ElectronApplication
let page: Page

test.beforeAll(async () => {
  electronApp = await electron.launch({ args: ['.'] })
  page = await electronApp.firstWindow()
})

test.afterAll(async () => {
  await electronApp.close()
})

// Drives dataset:query directly through window.api, bypassing the chat send
// flow (which would need a real AI reply) — this is the same rigor as 18-A's
// own live probes: proving the real Electron IPC boundary, not a UI click
// path. Answers the question the ipc skill leaves open for any new binary
// payload: does a Uint8Array survive invoke + contextBridge intact.
//
// Each evaluate callback re-casts `window` locally — it runs serialized in
// the page, with no access to anything defined in this Node-side module
// (testing skill: the cast stays inside evaluate, never in a shared helper).
test('runs a real query against a real attached CSV through the real Electron IPC boundary', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/sample.csv')

  const attached = await page.evaluate(async (path) => {
    const api = (window as unknown as { api: Api }).api
    const result = await api.dataset.attach(path, 'e2e-attach')
    if (!result.ok) throw new Error(`attach failed: ${JSON.stringify(result.error)}`)
    return result.value
  }, fixturePath)

  expect(attached.columns).toEqual(['id', 'name', 'city'])
  expect(attached.rowCount).toBe(2)

  // Uint8Array survives invoke + contextBridge only if bytes actually arrive
  // as bytes, not some degraded plain object — asserted in-page, since that
  // is where the boundary is actually crossed; only a plain array comes back
  // to Node, avoiding any ambiguity in Playwright's own evaluate serializer.
  const probe = await page.evaluate(async (hash) => {
    const api = (window as unknown as { api: Api }).api
    const result = await api.dataset.query(hash, 'SELECT * FROM dataset ORDER BY id')
    if (!result.ok) throw new Error(`query failed: ${JSON.stringify(result.error)}`)
    return {
      isUint8Array: result.value instanceof Uint8Array,
      byteLength: result.value.byteLength,
      bytes: Array.from(result.value)
    }
  }, attached.hash)

  expect(probe.isUint8Array).toBe(true)
  expect(probe.byteLength).toBeGreaterThan(0)

  const table = tableFromIPC(new Uint8Array(probe.bytes))
  const rows = [...table].map((row) => row.toArray())
  expect(rows).toEqual([
    [1n, 'Ana', 'São Paulo'],
    [2n, 'Bruno', 'Curitiba']
  ])
})

test('a non-read-only query is rejected as invalidQuery, without touching the worker', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/sample.csv')

  const error = await page.evaluate(async (path) => {
    const api = (window as unknown as { api: Api }).api
    const attached = await api.dataset.attach(path, 'e2e-attach-2')
    if (!attached.ok) throw new Error('attach failed')
    const result = await api.dataset.query(attached.value.hash, 'DROP VIEW dataset')
    return result.ok ? null : result.error
  }, fixturePath)

  expect(error).toEqual({
    kind: 'invalidQuery',
    message: 'Apenas consultas de leitura (SELECT/WITH) são permitidas.'
  })
})

test('a real DuckDB error (bad column) surfaces the engine text as invalidQuery', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/sample.csv')

  const error = await page.evaluate(async (path) => {
    const api = (window as unknown as { api: Api }).api
    const attached = await api.dataset.attach(path, 'e2e-attach-3')
    if (!attached.ok) throw new Error('attach failed')
    const result = await api.dataset.query(
      attached.value.hash,
      'SELECT missing_column FROM dataset'
    )
    return result.ok ? null : result.error
  }, fixturePath)

  expect(error?.kind).toBe('invalidQuery')
  expect((error as Extract<AppError, { kind: 'invalidQuery' }>).message).toMatch(/missing_column/i)
})

// clientes-latin1.csv is a real Latin-1/Windows-1252 export ("José da Silva",
// "São Paulo" as raw ISO-8859-1 bytes) — the exact shape that made
// read_csv_auto's plain utf-8 attempt throw before the worker's retry.
// See HISTORY.md § Correção pós-18-C.
test('a Latin-1 CSV queries successfully via the encoding retry, decoding accents correctly', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/clientes-latin1.csv')

  const bytes = await page.evaluate(async (path) => {
    const api = (window as unknown as { api: Api }).api
    const attached = await api.dataset.attach(path, 'e2e-attach-4')
    if (!attached.ok) throw new Error('attach failed')
    const result = await api.dataset.query(
      attached.value.hash,
      'SELECT * FROM dataset ORDER BY cliente_id'
    )
    if (!result.ok) throw new Error(`query failed: ${JSON.stringify(result.error)}`)
    return Array.from(result.value)
  }, fixturePath)

  const table = tableFromIPC(new Uint8Array(bytes))
  const rows = [...table].map((row) => row.toArray())
  expect(rows[0]).toEqual([1n, 'José da Silva', 'São Paulo', true, 'jose@example.com'])
  expect(rows[1]).toEqual([2n, 'Ana Souza', 'Curitiba', false, 'ana@example.com'])
})
