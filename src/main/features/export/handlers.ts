import { dirname, join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { SaveDialogOptions, SaveDialogReturnValue } from 'electron'
import type { Args, ExportFormat, Result } from '@shared/ipc'
import { ok } from '@core/result'
import { toPlainText } from '@core/export/toPlainText'
import { toDocx } from '@core/export/toDocx'
import { toHtml } from '@core/export/toHtml'
import { writeAtomic } from '@core/export/write'
import { readSettings, writeSettings } from '../settings/handlers'

type ShowSaveDialog = (options: SaveDialogOptions) => Promise<SaveDialogReturnValue>

type Filter = { name: string; extensions: string[] }

const FILTERS: Record<Exclude<ExportFormat, 'source'>, Filter> = {
  md: { name: 'Markdown', extensions: ['md'] },
  txt: { name: 'Texto', extensions: ['txt'] },
  docx: { name: 'Word', extensions: ['docx'] },
  pdf: { name: 'PDF', extensions: ['pdf'] }
}

// A code draft's extension comes from its language, which only the renderer
// resolved — so it arrives already in `suggestedName` rather than as a second
// field to keep in step. A name with no dot is a whole-name language like
// Dockerfile (DE2B.3).
function filterFor(format: ExportFormat, suggestedName: string): Filter {
  if (format !== 'source') return FILTERS[format]
  const dot = suggestedName.lastIndexOf('.')
  const extension = dot === -1 ? '' : suggestedName.slice(dot + 1)
  return { name: 'Código', extensions: extension === '' ? ['*'] : [extension] }
}

/** Turns HTML into pdf bytes — injected, because only `main` may open a window. */
type PrintPdf = (html: string) => Promise<Uint8Array>

function render(
  text: string,
  format: ExportFormat,
  printPdf: PrintPdf
): Promise<string | Uint8Array> | string {
  // `md` and `source` both fall through to the verbatim return below: one is
  // already markdown, the other must never be parsed as any (DE2B.5).
  if (format === 'txt') return toPlainText(text)
  if (format === 'docx') return toDocx(text)
  if (format === 'pdf') return printPdf(toHtml(text))
  return text
}

/**
 * Asks where to save, writes there, and remembers the folder.
 *
 * @param showSaveDialog - Injected, like `pickDataset`'s open dialog.
 * @param printPdf - Injected too, so level 3 runs without Electron (DE1F.6).
 * @returns The path written, or `null` when the dialog was cancelled.
 */
export async function saveExport(
  { text, format, suggestedName }: Args<'export:save'>,
  showSaveDialog: ShowSaveDialog,
  printPdf: PrintPdf,
  db: DatabaseSync
): Promise<Result<{ path: string } | null>> {
  const { lastExportDir } = readSettings(undefined, db)

  const { canceled, filePath } = await showSaveDialog({
    // ONE filter, because the format was already chosen in the footer: a second
    // one would be a second place to decide the same thing, and Electron's
    // extension handling with several filters plus defaultPath is a known
    // source of surprises (DE1D.1).
    filters: [filterFor(format, suggestedName)],
    defaultPath: lastExportDir === undefined ? suggestedName : join(lastExportDir, suggestedName)
  })

  if (canceled || filePath === undefined || filePath === '') return ok(null)

  const written = await writeAtomic(filePath, await render(text, format, printPdf))
  if (!written.ok) return written

  writeSettings({ lastExportDir: dirname(filePath) }, db)
  return ok({ path: filePath })
}
