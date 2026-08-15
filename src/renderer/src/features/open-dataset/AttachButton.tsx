import { useId, useState } from 'react'
import { Paperclip } from 'lucide-react'
import Button from '../../shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Popover from '../../shared/ui/Popover/Popover'
import { toAnchorName } from '../../shared/ui/Popover/anchorName'
import StateView from '../../shared/ui/StateView'
import { useOpenDataset } from './useOpenDataset'

// The composer's clip (DS5, item 7) — relocates what OpenDatasetPanel used to
// render as a standalone sidebar section (D13.7 area) into the composer's
// controls row. Same hook, no new IPC.
//
// `useOpenDataset` is a job with progress and cancellation, and `popover="auto"`
// light-dismisses on any outside click (DS5.5): a click on "Escolher arquivo"
// closes the popover FIRST, same idiom as the kebab menu's `setOpen(false)`
// before acting, so the native file dialog never has to fight the popover's
// own dismiss behaviour. Progress and Cancelar render in the row itself, never
// inside the popover, since it may be closed the whole time the job runs.
function AttachButton(): React.JSX.Element {
  const { state, pick, cancel } = useOpenDataset()
  const [open, setOpen] = useState(false)
  const anchorName = toAnchorName(useId())
  const isLoading = state.status === 'loading'

  const handlePick = (): void => {
    setOpen(false)
    void pick()
  }

  return (
    <>
      <Button
        variant="ghost"
        size="md"
        style={{ anchorName }}
        aria-label="Anexar arquivo"
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Paperclip size={ICON_SIZE.md} strokeWidth={ICON_STROKE} />
      </Button>

      {isLoading && (
        <div className="flex flex-none items-center gap-2 text-xs whitespace-nowrap text-text-muted">
          <span>Lendo arquivo…</span>
          <Button variant="secondary" size="sm" type="button" onClick={cancel}>
            Cancelar
          </Button>
        </div>
      )}

      <Popover open={open} onClose={() => setOpen(false)} anchorName={anchorName}>
        <div className="flex w-[240px] flex-col gap-3 p-1">
          {!isLoading && (
            <Button variant="primary" size="sm" type="button" onClick={handlePick}>
              Escolher arquivo
            </Button>
          )}
          <StateView
            state={state}
            emptyMessage="Nenhum arquivo aberto ainda."
            render={(summary) => (
              // display:contents on each pair so dt/dd sit directly in the 2-col grid.
              <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-xs">
                <div className="contents">
                  <dt className="text-text-muted">Separador</dt>
                  <dd className="text-text [word-break:break-word]">
                    {summary.delimiter === '\t' ? 'tabulação' : summary.delimiter}
                  </dd>
                </div>
                <div className="contents">
                  <dt className="text-text-muted">Colunas</dt>
                  <dd className="text-text [word-break:break-word]">
                    {summary.columns.length > 0 ? summary.columns.join(', ') : '—'}
                  </dd>
                </div>
                <div className="contents">
                  <dt className="text-text-muted">Linhas</dt>
                  <dd className="text-text [word-break:break-word]">{summary.rowCount}</dd>
                </div>
              </dl>
            )}
          />
        </div>
      </Popover>
    </>
  )
}

export default AttachButton
