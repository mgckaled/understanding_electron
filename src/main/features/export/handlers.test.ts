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

/** Stands in for the hidden window: level 3 must not need Electron (DE1F.6). */
const printer = vi.fn(async (html: string) => new TextEncoder().encode(`%PDF-${html.length}`))

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
      printer,
      db
    )

    expect(result).toEqual({ ok: true, value: { path: join(dir, 'Vendas.md') } })
    expect(await readFile(join(dir, 'Vendas.md'), 'utf-8')).toBe(MARKDOWN)
  })

  it('strips the markdown for txt', async () => {
    await saveExport(
      { text: MARKDOWN, format: 'txt', suggestedName: 'Vendas.txt' },
      dialogChoosing('Vendas.txt'),
      printer,
      db
    )

    const written = await readFile(join(dir, 'Vendas.txt'), 'utf-8')
    expect(written).not.toContain('#')
    expect(written).not.toContain('**')
    expect(written).toContain('Vendas')
  })

  it('writes a real docx, not the markdown with another extension', async () => {
    const result = await saveExport(
      { text: MARKDOWN, format: 'docx', suggestedName: 'Vendas.docx' },
      dialogChoosing('Vendas.docx'),
      printer,
      db
    )

    expect(result.ok).toBe(true)
    const bytes = await readFile(join(dir, 'Vendas.docx'))
    // A docx is a zip; the markdown would have started with `#`.
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
  })

  // DE1F.6: the window belongs to main, so the handler receives the printer
  // instead of reaching for it — and what it hands over is the escaped HTML.
  it('prints the html of the draft and writes whatever comes back', async () => {
    await saveExport(
      { text: '# Vendas\n\n<script>alert(1)</script>', format: 'pdf', suggestedName: 'V.pdf' },
      dialogChoosing('V.pdf'),
      printer,
      db
    )

    const html = printer.mock.calls.at(-1)?.[0] ?? ''
    expect(html).toContain('<h1>Vendas</h1>')
    expect(html).not.toContain('<script>')
    expect(await readFile(join(dir, 'V.pdf'), 'utf-8')).toBe(`%PDF-${html.length}`)
  })

  // DE2B.5: every other format parses the text as markdown, and markdown joins
  // consecutive lines and reads four leading spaces as a nested block. The whole
  // point of `source` is that NOTHING happens to the bytes.
  const CODE = [
    'class Person {',
    '  name: string',
    '',
    '    greet() {',
    '        return 1',
    '    }',
    '}'
  ].join('\n')

  it('writes code byte for byte, with no markdown parsing', async () => {
    await saveExport(
      { text: CODE, format: 'source', suggestedName: 'Person.ts' },
      dialogChoosing('Person.ts'),
      printer,
      db
    )

    expect(await readFile(join(dir, 'Person.ts'), 'utf-8')).toBe(CODE)
  })

  it('takes the dialog filter from the suggested name, since the language is not sent', async () => {
    const dialog = dialogChoosing('consulta.sql')

    await saveExport(
      { text: 'select 1', format: 'source', suggestedName: 'consulta.sql' },
      dialog,
      printer,
      db
    )

    expect(dialog.mock.calls[0]?.[0].filters).toEqual([{ name: 'Código', extensions: ['sql'] }])
  })

  // DE2B.3: a whole-name language like Dockerfile arrives with no dot at all.
  it('offers every extension when the suggested name carries none', async () => {
    const dialog = dialogChoosing('Dockerfile')

    await saveExport(
      { text: 'FROM node', format: 'source', suggestedName: 'Dockerfile' },
      dialog,
      printer,
      db
    )

    expect(dialog.mock.calls[0]?.[0].filters).toEqual([{ name: 'Código', extensions: ['*'] }])
  })

  it('is a cancellation, not a failure, when the dialog is dismissed', async () => {
    const result = await saveExport(
      { text: MARKDOWN, format: 'md', suggestedName: 'Vendas.md' },
      cancelled,
      printer,
      db
    )

    expect(result).toEqual({ ok: true, value: null })
  })

  // DE1D.1: one filter, because the footer already chose the format.
  it('offers exactly the chosen format to the dialog', async () => {
    const dialog = dialogChoosing('Vendas.txt')

    await saveExport(
      { text: MARKDOWN, format: 'txt', suggestedName: 'Vendas.txt' },
      dialog,
      printer,
      db
    )

    const options = dialog.mock.calls[0][0]
    expect(options.filters).toEqual([{ name: 'Texto', extensions: ['txt'] }])
  })

  // DE1D.5: Electron pins Downloads and the OS no longer restores the last
  // folder, so the second export would start over without this.
  it('opens the next dialog where the last export landed', async () => {
    await saveExport(
      { text: MARKDOWN, format: 'md', suggestedName: 'Vendas.md' },
      dialogChoosing('Vendas.md'),
      printer,
      db
    )
    expect(readSettings(undefined, db).lastExportDir).toBe(dir)

    const second = dialogChoosing('Custos.md')
    await saveExport(
      { text: MARKDOWN, format: 'md', suggestedName: 'Custos.md' },
      second,
      printer,
      db
    )

    const options = second.mock.calls[0][0]
    expect(options.defaultPath).toBe(join(dir, 'Custos.md'))
  })

  it('remembers nothing when the dialog was cancelled', async () => {
    await saveExport(
      { text: MARKDOWN, format: 'md', suggestedName: 'Vendas.md' },
      cancelled,
      printer,
      db
    )

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
      printer,
      db
    )

    expect(result.ok).toBe(false)
    expect(readSettings(undefined, db).lastExportDir).toBeUndefined()
  })
})
