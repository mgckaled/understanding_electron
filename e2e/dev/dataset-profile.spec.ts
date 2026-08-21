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

// null_percentage's scale (0-100 vs. a 0-1 fraction) is not documented by
// DuckDB in a way Context7 surfaced — measured live in this session at 25
// for 1 null in 4 rows, confirming ColumnProfile.nullPercentage needs no
// scaling before display. Locked in as a permanent regression, not just a
// one-off script, since a silent 100x error here would ship wrong and no
// unit test touches the worker's SUMMARIZE-row parsing.
test('nullPercentage is already on a 0-100 scale, not a 0-1 fraction', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/nulos.csv')

  const profile = await page.evaluate(async (path) => {
    const api = (window as unknown as { api: Api }).api
    const attached = await api.dataset.attach(path, 'e2e-profile-nulls')
    if (!attached.ok) throw new Error('attach failed')
    const result = await api.dataset.profile(attached.value.hash)
    if (!result.ok) throw new Error('profile failed')
    return result.value
  }, fixturePath)

  const idade = profile.find((column) => column.column === 'idade')
  expect(idade?.nullPercentage).toBe(25)
})

// Same shared encodingByHash/ensureView path as dataset:query (D18D.3) — a
// profile handler that built its own view SQL instead of reusing it would
// regress the post-18-C encoding fix silently, only on an accented-header
// Latin-1 file. No other test exercises this path for dataset:profile.
test('profiles a Latin-1 CSV via the same encoding retry as dataset:query', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/clientes-latin1.csv')

  const profile = await page.evaluate(async (path) => {
    const api = (window as unknown as { api: Api }).api
    const attached = await api.dataset.attach(path, 'e2e-profile-latin1')
    if (!attached.ok) throw new Error('attach failed')
    const result = await api.dataset.profile(attached.value.hash)
    if (!result.ok) throw new Error(`profile failed: ${JSON.stringify(result.error)}`)
    return result.value
  }, fixturePath)

  expect(profile.map((column) => column.column)).toEqual([
    'cliente_id',
    'nome',
    'cidade',
    'vip',
    'email'
  ])
  // Only 2 rows — every column is 100% unique, so none qualifies for top-N
  // (D18D.2's ratio gate). min/max are what SUMMARIZE gives back here, and
  // they are the field that would mojibake if the encoding retry silently
  // regressed for this handler.
  const nome = profile.find((column) => column.column === 'nome')
  expect([nome?.min, nome?.max]).toEqual(expect.arrayContaining(['José da Silva', 'Ana Souza']))
})

// Found live, post-18-E: SUMMARIZE's own `avg` for DATE/TIMESTAMP is a real
// value, but a datetime STRING ("2023-11-04 12:00:00"), not null like a
// VARCHAR column's. `Number(...)` on that string is NaN — a silent
// `avg: number | null` contract violation the renderer had no guard for
// (printed the literal text "NaN" in the Perfil table). Fixed in
// workers/duckdb/index.ts by treating a non-finite parse as null, same as a
// genuinely absent avg.
test('avg is null, not NaN, for DATE and TIMESTAMP columns', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/sample.ndjson')

  const profile = await page.evaluate(async (path) => {
    const api = (window as unknown as { api: Api }).api
    const attached = await api.dataset.attach(path, 'e2e-profile-date-avg')
    if (!attached.ok) throw new Error('attach failed')
    const result = await api.dataset.profile(attached.value.hash)
    if (!result.ok) throw new Error(`profile failed: ${JSON.stringify(result.error)}`)
    return result.value
  }, fixturePath)

  const nascimento = profile.find((column) => column.column === 'nascimento')
  const criadoEm = profile.find((column) => column.column === 'criado_em')
  expect(nascimento?.avg).toBeNull()
  expect(criadoEm?.avg).toBeNull()
})
