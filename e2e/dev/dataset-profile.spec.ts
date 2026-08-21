import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { join } from 'node:path'
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

// Drives dataset:profile directly through window.api, same rigor as
// dataset-query.spec.ts — proving the real worker orchestration (materialize
// -> COUNT(*) -> SUMMARIZE -> gated top-N -> DROP, D18D.2) against a real
// DuckDB instance, not a mock. perfil.csv has a low-cardinality column
// (cidade, 2 distinct values in 10 rows) and two near-unique ones (id,
// idade) so the cardinality gate (D18D.2) is actually exercised both ways.
test('profiles a real attached CSV, gating top-N by cardinality', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/perfil.csv')

  const profile = await page.evaluate(async (path) => {
    const api = (window as unknown as { api: Api }).api
    const attached = await api.dataset.attach(path, 'e2e-profile-attach')
    if (!attached.ok) throw new Error(`attach failed: ${JSON.stringify(attached.error)}`)
    const result = await api.dataset.profile(attached.value.hash)
    if (!result.ok) throw new Error(`profile failed: ${JSON.stringify(result.error)}`)
    return result.value
  }, fixturePath)

  expect(profile.map((column) => column.column)).toEqual(['id', 'cidade', 'idade'])

  const cidade = profile.find((column) => column.column === 'cidade')
  expect(cidade?.approxUnique).toBe(2)
  expect(cidade?.nullPercentage).toBe(0)
  expect(cidade?.topValues).toEqual(
    expect.arrayContaining([
      { value: 'São Paulo', count: 6 },
      { value: 'Curitiba', count: 4 }
    ])
  )

  // approx_unique is a HyperLogLog estimate, not an exact count — measured
  // live at 11 for 10 truly distinct ids, so this asserts "close to 10", not
  // "= 10". The ratio gate (D18D.2) still excludes it either way.
  const id = profile.find((column) => column.column === 'id')
  expect(id?.approxUnique).toBeGreaterThanOrEqual(9)
  expect(id?.approxUnique).toBeLessThanOrEqual(11)
  expect(id?.topValues).toBeUndefined()

  const idade = profile.find((column) => column.column === 'idade')
  expect(idade?.approxUnique).toBeGreaterThanOrEqual(9)
  expect(idade?.approxUnique).toBeLessThanOrEqual(11)
  expect(idade?.topValues).toBeUndefined()
  expect(idade?.avg).toBeCloseTo((25 + 30 + 22 + 40 + 35 + 28 + 31 + 45 + 26 + 33) / 10, 1)
})

test("a second profile request, for a different hash, does not see the first one's scratch table", async () => {
  const perfilPath = join(process.cwd(), 'e2e/fixtures/perfil.csv')
  const samplePath = join(process.cwd(), 'e2e/fixtures/sample.csv')

  const [first, second] = await page.evaluate(
    async ([pathA, pathB]) => {
      const api = (window as unknown as { api: Api }).api
      const attachedA = await api.dataset.attach(pathA, 'e2e-profile-a')
      const attachedB = await api.dataset.attach(pathB, 'e2e-profile-b')
      if (!attachedA.ok || !attachedB.ok) throw new Error('attach failed')
      const profileA = await api.dataset.profile(attachedA.value.hash)
      const profileB = await api.dataset.profile(attachedB.value.hash)
      if (!profileA.ok || !profileB.ok) throw new Error('profile failed')
      return [profileA.value, profileB.value]
    },
    [perfilPath, samplePath]
  )

  expect(first.map((column) => column.column)).toEqual(['id', 'cidade', 'idade'])
  expect(second.map((column) => column.column)).toEqual(['id', 'name', 'city'])
})
