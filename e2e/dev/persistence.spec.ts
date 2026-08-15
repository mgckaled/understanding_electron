import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import type { Api } from '@shared/ipc'

/*
 * The one proof only level 4 can give: the application is CLOSED and launched
 * again. Levels 1–3 can assert that a row was written and read back; none of
 * them can assert that it survived the process going away, because none of them
 * has a process to lose.
 *
 * ⚠️ The trap here bites before any assertion. e2e runs against the machine's
 * REAL userData, so without the flag below this spec would write test
 * conversations into the developer's own %APPDATA%\crivo — and a spec that
 * wiped it to start clean would wipe a real history. Hence a throwaway
 * directory per run, and the first expectation is that the flag actually took
 * effect: it is checked BEFORE anything is written.
 */

const userDataDir = mkdtempSync(join(tmpdir(), 'crivo-e2e-'))
const TITLE = 'Conversa que sobrevive'

test.afterAll(() => {
  // Windows keeps the directory handle for a moment after the process exits,
  // and a leftover temp folder is not worth failing a green run over — a
  // teardown that throws would report the wrong thing about the test itself.
  try {
    rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  } catch {
    // Left for the OS to reap.
  }
})

/** Exact, because "Editar título de <título>" and "Excluir <título>" contain it too. */
function row(page: Page, title: string): ReturnType<Page['getByRole']> {
  return page.getByRole('button', { name: title, exact: true })
}

async function open(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`] })
  const page = await app.firstWindow()
  // The sidebar's "Conversas" heading was replaced by date groups (DS-3), so the
  // stable "shell is up" signal is the New conversation button the test uses next.
  await page.getByRole('button', { name: 'Nova conversa' }).waitFor()
  return { app, page }
}

test('a conversa sobrevive ao fechamento do aplicativo', async () => {
  const first = await open()

  // Before the first write, not after: the whole point is not to touch the
  // real database, and asserting that afterwards would be too late.
  expect(await first.app.evaluate(({ app }) => app.getPath('userData'))).toBe(userDataDir)

  await first.page.getByRole('button', { name: 'Nova conversa' }).click()
  // The row's kebab is visibility: hidden until the row is hovered — a detail
  // no level-2 test can see, because jsdom applies no CSS. It opens a Popover
  // (DS-4 passo 4) with the rename/delete actions, replacing the two buttons
  // that used to sit directly in the row.
  await first.page.locator('li', { hasText: 'Nova conversa' }).first().hover()
  await first.page.getByRole('button', { name: 'Mais ações para Nova conversa' }).click()
  await first.page.getByRole('button', { name: 'Editar título de Nova conversa' }).click()
  await first.page.getByLabel('Novo título da conversa').fill(TITLE)
  await first.page.keyboard.press('Enter')
  await row(first.page, TITLE).waitFor()

  /*
   * The turn is written through the preload surface rather than by typing into
   * the composer, and that is deliberate: sending needs Ollama answering on
   * this machine, which is not something an e2e run can assume — the composer
   * is disabled when it is not there. Everything under test is still exercised
   * end to end: renderer → preload → IPC → zod → handler → SQLite, and back out
   * through the UI in the second session.
   */
  const conversationId = await first.page.evaluate(async () => {
    const api = (window as unknown as { api: Api }).api
    const [conversation] = await api.conversation.list()
    const now = Date.now()
    await api.conversation.append(conversation.id, {
      id: 'e2e-user',
      role: 'user',
      parts: [{ kind: 'text', text: 'quantas linhas tem o arquivo?' }],
      createdAt: now
    })
    await api.conversation.append(conversation.id, {
      id: 'e2e-assistant',
      role: 'assistant',
      parts: [{ kind: 'text', text: 'O arquivo tem' }],
      createdAt: now + 1,
      model: 'gemma3:4b',
      stopped: 'cancelled'
    })
    return conversation.id
  })

  await first.app.close()

  const second = await open()

  // Everything below reads the reopened UI, never the database directly: what
  // is being proved is that the user finds the conversation, not that a row
  // exists somewhere.
  await row(second.page, TITLE).click()

  await expect(second.page.getByText('quantas linhas tem o arquivo?')).toBeVisible()
  await expect(second.page.getByText('O arquivo tem')).toBeVisible()
  // The marker survived too: reading an old conversation, "there is no answer"
  // and "the answer was cut short" must not look the same (D14.3).
  await expect(second.page.getByText(/interrompida por você/)).toBeVisible()

  expect(
    await second.page.evaluate(
      async (id) =>
        (await (window as unknown as { api: Api }).api.conversation.messages(id)).length,
      conversationId
    )
  ).toBe(2)

  await second.app.close()
})
