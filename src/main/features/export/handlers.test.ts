import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { Mock } from 'vitest'
import type { SaveDialogOptions, SaveDialogReturnValue } from 'electron'
import { openDatabase } from '../../db/open'
import { readSettings } from '../settings/handlers'
import { saveExport } from './handlers'

const MARKDOWN = '# Vendas\n\nSubiram **12%**.'

let db: DatabaseSync
let dir: string

type Dialog = Mock<(options: SaveDialogOptions) => Promise<SaveDialogReturnValue>>

/** A dialog that always answers with `<dir>/<name>`, recording what it was asked. */
function dialogChoosing(name: string): Dialog {
  return vi.fn(async () => ({ canceled: false, filePath: join(dir, name) }))
}

const cancelled: Dialog = vi.fn(async () => ({ canceled: true, filePath: '' }))

beforeEach(async () => {
  db = openDatabase(':memory:')
  dir = await mkdtemp(join(tmpdir(), 'crivo-save-'))
})
afterEach(async () => {
  db.close()
  await rm(dir, { recursive: true, force: true })
})

describe('saveExport', () => {
  it('writes the markdown as it is and returns the path', async () => {
    const result = await saveExport(
      { text: MARKDOWN, format: 'md', suggestedName: 'Vendas.md' },
      dialogChoosing('Vendas.md'),
      db
    )

    expect(result).toEqual({ ok: true, value: { path: join(dir, 'Vendas.md') } })
    expect(await readFile(join(dir, 'Vendas.md'), 'utf-8')).toBe(MARKDOWN)
  })

  it('strips the markdown for txt', async () => {
    await saveExport(
      { text: MARKDOWN, format: 'txt', suggestedName: 'Vendas.txt' },
      dialogChoosing('Vendas.txt'),
      db
    )

    const written = await readFile(join(dir, 'Vendas.txt'), 'utf-8')
    expect(written).not.toContain('#')
    expect(written).not.toContain('**')
    expect(written).toContain('Vendas')
  })

  it('is a cancellation, not a failure, when the dialog is dismissed', async () => {
    const result = await saveExport(
      { text: MARKDOWN, format: 'md', suggestedName: 'Vendas.md' },
      cancelled,
      db
    )

    expect(result).toEqual({ ok: true, value: null })
  })

  // DE1D.1: one filter, because the footer already chose the format.
  it('offers exactly the chosen format to the dialog', async () => {
    const dialog = dialogChoosing('Vendas.txt')

    await saveExport({ text: MARKDOWN, format: 'txt', suggestedName: 'Vendas.txt' }, dialog, db)

    const options = dialog.mock.calls[0][0]
    expect(options.filters).toEqual([{ name: 'Texto', extensions: ['txt'] }])
  })

  // DE1D.5: Electron pins Downloads and the OS no longer restores the last
  // folder, so the second export would start over without this.
  it('opens the next dialog where the last export landed', async () => {
    await saveExport(
      { text: MARKDOWN, format: 'md', suggestedName: 'Vendas.md' },
      dialogChoosing('Vendas.md'),
      db
    )
    expect(readSettings(undefined, db).lastExportDir).toBe(dir)

    const second = dialogChoosing('Custos.md')
    await saveExport({ text: MARKDOWN, format: 'md', suggestedName: 'Custos.md' }, second, db)

    const options = second.mock.calls[0][0]
    expect(options.defaultPath).toBe(join(dir, 'Custos.md'))
  })

  it('remembers nothing when the dialog was cancelled', async () => {
    await saveExport({ text: MARKDOWN, format: 'md', suggestedName: 'Vendas.md' }, cancelled, db)

    expect(readSettings(undefined, db).lastExportDir).toBeUndefined()
  })

  it('passes a write failure through instead of claiming success', async () => {
    const intoAGhostFolder: Dialog = vi.fn(async () => ({
      canceled: false,
      filePath: join(dir, 'sem-pasta', 'Vendas.md')
    }))

    const result = await saveExport(
      { text: MARKDOWN, format: 'md', suggestedName: 'Vendas.md' },
      intoAGhostFolder,
      db
    )

    expect(result.ok).toBe(false)
    expect(readSettings(undefined, db).lastExportDir).toBeUndefined()
  })
})
