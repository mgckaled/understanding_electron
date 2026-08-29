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

// The three ways in that F-3-B adds, in a real Chromium: the header clip, the
// picker, and the accelerator. None of them is provable at level 2 in the way
// that matters — the clip reads a real transcript, the picker's popover is
// `display:none` under jsdom, and a keyboard accelerator is a keyboard.
test('reaches the panel through the header clip, the picker and Ctrl+B', async () => {
  const two = await page.evaluate(
    async (paths) => {
      const api = (window as unknown as { api: Api }).api
      const first = await api.document.attach(paths.doc, 'e2e-clip-1')
      const second = await api.image.attach(paths.img, 'e2e-clip-2')
      if (!first.ok || !second.ok) throw new Error('attach failed')

      const id = `c-clip-${Date.now()}`
      await api.conversation.create({ id, title: 'Dois anexos', createdAt: Date.now() })
      await api.conversation.append(id, {
        id: `m1-${Date.now()}`,
        role: 'user',
        parts: [first.value],
        createdAt: Date.now()
      })
      await api.conversation.append(id, {
        id: `m2-${Date.now()}`,
        role: 'user',
        parts: [second.value],
        createdAt: Date.now() + 1
      })
      return { doc: first.value.fileName, img: second.value.fileName }
    },
    {
      doc: join(process.cwd(), 'e2e/fixtures/especificacao.md'),
      img: join(process.cwd(), 'e2e/fixtures/quadrado.png')
    }
  )

  await page.reload()
  const panel = page.getByRole('complementary', { name: 'Anexo aberto' })

  // The clip counts both and opens the NEWEST — the image, not the document.
  const clip = page.getByRole('button', { name: /anexos da conversa \(2\)/ })
  await expect(clip).toBeVisible()
  await clip.click()
  await expect(panel).toContainText(two.img)

  // The picker switches without closing.
  await panel.getByRole('button', { name: new RegExp(two.img) }).click()
  await page.getByRole('button', { name: two.doc, exact: true }).click()
  await expect(panel).toBeVisible()
  await expect(panel).toContainText(two.doc)

  // Ctrl+B closes, Ctrl+B opens again.
  await page.keyboard.press('Control+b')
  await expect(panel).toBeHidden()
  await page.keyboard.press('Control+b')
  await expect(panel).toBeVisible()

  // The "never while typing" guard is NOT asserted here: the composer's
  // textarea is disabled whenever the app cannot reach a model, which is the
  // state this spec runs in. It is covered at level 2 against the real
  // provider, where a focused field can be arranged.
})

// F-3-C, and the reason it is here: none of the three items is provable below
// level 4. The sidebar collapsing needs a real viewport, the drag needs real
// layout, and the fade needs a compositor.
test('cede espaço numa janela estreita, e o arrasto muda a largura', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/especificacao.md')

  await page.evaluate(async (path) => {
    const api = (window as unknown as { api: Api }).api
    const result = await api.document.attach(path, 'e2e-artifact-resize')
    if (!result.ok) throw new Error(`attach failed: ${JSON.stringify(result.error)}`)

    const id = `c-resize-${Date.now()}`
    await api.conversation.create({ id, title: 'Arrasto', createdAt: Date.now() })
    await api.conversation.append(id, {
      id: `m-${Date.now()}`,
      role: 'user',
      parts: [result.value],
      createdAt: Date.now()
    })
  }, fixturePath)

  async function setWindow(w: number, h: number): Promise<void> {
    await electronApp.evaluate(
      ({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(size.w, size.h),
      { w, h }
    )
  }

  async function widthOf(selector: string): Promise<number> {
    return page.evaluate(
      (css) => document.querySelector(css)?.getBoundingClientRect().width ?? 0,
      selector
    )
  }

  const SIDEBAR = 'aside[aria-label="Conversas"]'
  const PANEL = 'aside[aria-label="Anexo aberto"]'

  await setWindow(900, 700)
  // Reload also resets the shell: a previous test may have left the sidebar
  // collapsed, and this one is about who collapses it.
  await page.reload()
  const card = page.getByRole('button', { name: /especificacao\.md/ })
  await expect(card).toBeVisible()
  expect(await widthOf(SIDEBAR)).toBeGreaterThan(200)

  await card.click()
  await expect(page.getByRole('complementary', { name: 'Anexo aberto' })).toBeVisible()

  // DF3C.3: the three regions do not fit at this size, so the sidebar yields —
  // polled because it animates (DF3C.1 duration, inherited from the DS).
  await expect.poll(() => widthOf(SIDEBAR)).toBeLessThan(100)
  const threadCollapsed = await widthOf('main')

  // DF3C.4 proved by the coupling itself: expanding the sidebar by hand has to
  // take room from the thread, which only happens because the panel's ceiling
  // reads the sidebar's LIVE width. It also exercises the override of DF3C.3 —
  // nothing re-collapses it afterwards.
  await page.getByRole('button', { name: 'Expandir a barra lateral' }).click()
  await expect.poll(() => widthOf(SIDEBAR)).toBeGreaterThan(200)
  expect(await widthOf('main')).toBeLessThan(threadCollapsed)

  // Maximized, because at 900px the panel is already at its ceiling and a drag
  // would have nowhere to go.
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].maximize())
  await page.waitForFunction(() => window.innerWidth > 1000)

  const handle = page.getByRole('separator', { name: 'Redimensionar o painel' })
  const box = (await handle.boundingBox())!
  const panelBefore = await widthOf(PANEL)

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x - 150, box.y + box.height / 2, { steps: 10 })
  await page.mouse.up()

  // Invariants, never pixels: this machine scales the display.
  const panelDragged = await widthOf(PANEL)
  expect(panelDragged).toBeGreaterThan(panelBefore)
  expect(panelDragged + (await widthOf('main'))).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth)
  )

  await handle.dblclick()
  await expect.poll(() => widthOf(PANEL)).toBeLessThan(panelDragged)
})

// The dataset is the only artifact with more than one view, so it is the only
// one whose panel body has a tab strip, a pinned footer and its own scrolling
// region. jsdom judges none of that: it has no layout, so `flex-1`,
// `min-h-[0px]` and a `sticky` header all pass there whether or not they work.
test('opens a dataset in the panel and moves between its three tabs', async () => {
  const fixturePath = join(process.cwd(), 'e2e/fixtures/perfil.csv')

  await page.evaluate(async (path) => {
    const api = (window as unknown as { api: Api }).api
    const result = await api.dataset.attach(path, 'e2e-artifact-dataset')
    if (!result.ok) throw new Error(`attach failed: ${JSON.stringify(result.error)}`)

    const id = `c-dataset-${Date.now()}`
    await api.conversation.create({ id, title: 'Dataset', createdAt: Date.now() })
    await api.conversation.append(id, {
      id: `m-${Date.now()}`,
      role: 'user',
      parts: [result.value],
      createdAt: Date.now()
    })
  }, fixturePath)

  await page.reload()
  await page.getByRole('button', { name: /perfil\.csv/ }).click()

  const panel = page.getByRole('complementary', { name: 'Anexo aberto' })
  await expect(panel).toBeVisible()

  // Dados: the rows, and the footer telling the truth about how many there are.
  await expect(panel.getByRole('table')).toBeVisible()
  await expect(panel.getByText('1–10 de 10')).toBeVisible()

  // DF3D.4 in a real browser: present, and greyed out because OFFSET is
  // scheduled — not hidden, which is what DF3A.7 does to a capability that is
  // never coming.
  await expect(panel.getByRole('button', { name: 'Próxima página' })).toBeDisabled()

  // The strip must not scroll away with the rows, and the footer must not sit
  // on top of the last row — the reason the dataset body owns the whole region
  // instead of living inside the panel's scrolling div.
  const strip = panel.getByRole('tablist', { name: 'Vistas do arquivo' })
  await expect(strip).toBeVisible()
  const stripBox = (await strip.boundingBox())!
  expect(stripBox.height).toBeGreaterThan(0)

  await panel.getByRole('tab', { name: 'Perfil' }).click()
  await expect(panel.getByRole('cell', { name: 'cidade' })).toBeVisible()

  // Consulta: the keyboard path, which is the one a SQL tool is used through.
  await panel.getByRole('tab', { name: 'Consulta' }).click()
  const editor = panel.getByRole('textbox', { name: 'Consulta SQL' })
  await editor.click()
  await editor.press('Control+Enter')

  await expect(panel.getByText(/10 linhas · 3 colunas · \d+ ms/)).toBeVisible()

  // Arrow keys move between tabs and wrap, which is the half of the APG pattern
  // a mouse never exercises.
  await panel.getByRole('tab', { name: 'Consulta' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(panel.getByRole('tab', { name: 'Dados' })).toHaveAttribute('aria-selected', 'true')
})
