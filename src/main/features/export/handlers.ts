import { dirname, join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { SaveDialogOptions, SaveDialogReturnValue } from 'electron'
import type { Args, ExportFormat, Result } from '@shared/ipc'
import { ok } from '@core/result'
import { toPlainText } from '@core/export/toPlainText'
import { toDocx } from '@core/export/toDocx'
import { writeAtomic } from '@core/export/write'
import { readSettings, writeSettings } from '../settings/handlers'

type ShowSaveDialog = (options: SaveDialogOptions) => Promise<SaveDialogReturnValue>

const FILTERS: Record<ExportFormat, { name: string; extensions: string[] }> = {
  md: { name: 'Markdown', extensions: ['md'] },
  txt: { name: 'Texto', extensions: ['txt'] },
  docx: { name: 'Word', extensions: ['docx'] },
  pdf: { name: 'PDF', extensions: ['pdf'] }
}

function render(text: string, format: ExportFormat): Promise<string | Uint8Array> | string {
  if (format === 'txt') return toPlainText(text)
  if (format === 'docx') return toDocx(text)
  return text
}

/**
 * Asks where to save, writes there, and remembers the folder.
 *
 * @param showSaveDialog - Injected, like `pickDataset`'s open dialog.
 * @returns The path written, or `null` when the dialog was cancelled.
 */
export async function saveExport(
  { text, format, suggestedName }: Args<'export:save'>,
  showSaveDialog: ShowSaveDialog,
  db: DatabaseSync
): Promise<Result<{ path: string } | null>> {
  const { lastExportDir } = readSettings(undefined, db)

  const { canceled, filePath } = await showSaveDialog({
    // ONE filter, because the format was already chosen in the footer: a second
    // one would be a second place to decide the same thing, and Electron's
    // extension handling with several filters plus defaultPath is a known
    // source of surprises (DE1D.1).
    filters: [FILTERS[format]],
    defaultPath: lastExportDir === undefined ? suggestedName : join(lastExportDir, suggestedName)
  })

  if (canceled || filePath === undefined || filePath === '') return ok(null)

  const written = await writeAtomic(filePath, await render(text, format))
  if (!written.ok) return written

  writeSettings({ lastExportDir: dirname(filePath) }, db)
  return ok({ path: filePath })
}
