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

// The two things jsdom cannot prove about the F-3-A panel, both of them the
// reason this spec exists rather than a level-2 test:
//
// 1. the CSP really lets `fetch('attachment://…')` through. `connect-src`
//    (DF3A.7) is a header in index.html — level 2 has neither a CSP nor a
//    protocol handler, so a unit test asserting this would be asserting against
//    its own mock;
// 2. clicking a real attachment card really opens the region, in a real
//    Chromium with real layout.
test('opens an attached document in the artifact panel, and lets the CSP reach the bytes', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/especificacao.md')

  await page.evaluate(async (path) => {
    const api = (window as unknown as { api: Api }).api
    const result = await api.document.attach(path, 'e2e-artifact-doc')
    if (!result.ok) throw new Error(`attach failed: ${JSON.stringify(result.error)}`)

    const id = `c-artifact-${Date.now()}`
    await api.conversation.create({ id, title: 'Painel', createdAt: Date.now() })
    await api.conversation.append(id, {
      id: `m-${Date.now()}`,
      role: 'user',
      parts: [result.value],
      createdAt: Date.now()
    })

  }, fixturePath)

  // The card is in the transcript of the conversation just created, which the
  // list resolves to as the newest (D14.6) after a reload.
  await page.reload()
  const card = page.getByRole('button', { name: /especificacao\.md/ })
  await expect(card).toBeVisible()

  await expect(page.getByRole('complementary', { name: 'Anexo aberto' })).toBeHidden()
  await card.click()

  const panel = page.getByRole('complementary', { name: 'Anexo aberto' })
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Especificação' })).toBeVisible()
  await expect(panel).toContainText('Corpo do documento anexado')

  // The panel is the third grid track, so it must take real width away from the
  // conversation — a zero-wide region would satisfy every assertion above.
  // Measured at three window sizes, because the whole point of the clamp
  // (DF3A.4) is that it behaves differently at each.
  async function widths(): Promise<{ window: number; panel: number; main: number }> {
    return page.evaluate(() => ({
      window: window.innerWidth,
      panel: document.querySelector('aside[aria-label="Anexo aberto"]')!.getBoundingClientRect()
        .width,
      main: document.querySelector('main')!.getBoundingClientRect().width
    }))
  }

  async function resize(width: number, height: number): Promise<void> {
    await electronApp.evaluate(
      ({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(size.w, size.h),
      { w: width, h: height }
    )
    await page.waitForFunction((w) => window.innerWidth < w, width + 40)
  }

  // Asserted as invariants, not pixels: this machine scales the display, so
  // setSize() and innerWidth do not agree and an exact number would be a test
  // of the DPI, not of the clamp.
  function holds(at: { window: number; panel: number; main: number }): void {
    expect(at.panel).toBeLessThanOrEqual(at.window / 2 + 1) // the 50% ceiling
    expect(at.panel).toBeGreaterThan(300) // never a useless strip
    expect(at.panel + at.main).toBeLessThanOrEqual(at.window) // nothing overflows
  }

  const initial = await widths()
  holds(initial)

  // Full screen: the ceiling is what must hold, and the conversation must still
  // be the wider of the two.
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].maximize())
  await page.waitForFunction((w) => window.innerWidth > w, initial.window)
  const full = await widths()
  holds(full)
  expect(full.main).toBeGreaterThan(full.panel)

  // Narrow: the panel yields instead of holding 34rem, which is the whole point
  // of the clamp. Below this size the two genuinely compete for room —
  // overlaying instead of pushing is a decision left to F-3-B.
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].unmaximize())
  await resize(900, 700)
  const narrow = await widths()
  holds(narrow)
  expect(narrow.panel).toBeLessThan(full.panel)

  console.log('larguras medidas:', JSON.stringify({ initial, full, narrow }))

  // Esc closes it and hands focus back to the card that opened it (DF3A.8).
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(card).toBeFocused()
})
