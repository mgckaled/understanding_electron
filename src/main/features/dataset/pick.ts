import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import type { DatasetRef, Result } from '@shared/ipc'
import { ok } from '@core/result'

type ShowOpenDialog = (options: OpenDialogOptions) => Promise<OpenDialogReturnValue>

export async function pickDataset(
  _args: void,
  showOpenDialog: ShowOpenDialog
): Promise<Result<DatasetRef | null>> {
  const { canceled, filePaths } = await showOpenDialog({
    properties: ['openFile'],
    // The OS dialog shows only the FIRST filter's extensions by default — a
    // second filter is a dropdown the user has to notice and switch, not an
    // OR. A combined filter listed first is what makes both formats visible
    // without that extra step (bug found live: JSON/NDJSON were invisible
    // until the user manually picked the second filter).
    filters: [
      {
        name: 'Dados tabulares',
        extensions: ['csv', 'tsv', 'txt', 'json', 'ndjson', 'jsonl', 'xlsx']
      },
      { name: 'Delimited text', extensions: ['csv', 'tsv', 'txt'] },
      { name: 'JSON', extensions: ['json', 'ndjson', 'jsonl'] },
      { name: 'Excel', extensions: ['xlsx'] }
    ]
  })

  if (canceled || filePaths.length === 0) return ok(null)
  return ok({ path: filePaths[0] })
}
