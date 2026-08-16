import { useId, useState } from 'react'
import { Paperclip, X } from 'lucide-react'
import type { DatasetPart } from '@shared/ipc'
import Button from '../../shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Popover from '../../shared/ui/Popover/Popover'
import { toAnchorName } from '../../shared/ui/Popover/anchorName'
import StateView from '../../shared/ui/StateView'
import { useAttachDataset } from './useAttachDataset'

type AttachButtonProps = {
  /** The pending attachment, or null. Controlled — Composer holds it next to `draft` (D13.2, D16.6). */
  attachment: DatasetPart | null
  onAttached: (part: DatasetPart) => void
  onRemove: () => void
  disabled?: boolean
}

// The composer's clip (DS5, item 7; D16.6 keeps it there). What it produces
// now rides the next message instead of dying in the popover (fase 06's
// OpenDatasetPanel, retired in this plano). `useAttachDataset` resets to idle
// right after a successful pick — the fact "something is attached" lives ONE
// place, the `attachment` prop, never duplicated into this component's own
// state.
function AttachButton({
  attachment,
  onAttached,
  onRemove,
  disabled = false
}: AttachButtonProps): React.JSX.Element {
  const { state, pick, cancel } = useAttachDataset(onAttached)
  const [open, setOpen] = useState(false)
  const anchorName = toAnchorName(useId())
  const isLoading = state.status === 'loading'

  const handlePick = (): void => {
    setOpen(false)
    void pick()
  }

  return (
    <>
      {/* shape="square" (DS-5 fixup): icon-only, so the hover box wraps the
          icon, not a text button's horizontal padding. */}
      <Button
        variant="ghost"
        size="md"
        shape="square"
        style={{ anchorName }}
        disabled={disabled}
        aria-label="Anexar arquivo"
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Paperclip size={ICON_SIZE.md} strokeWidth={ICON_STROKE} />
      </Button>

      {attachment !== null && !isLoading && (
        <span className="flex max-w-[200px] items-center gap-2 rounded-md border border-border bg-surface-sunken py-1 pr-1 pl-3 text-xs text-text">
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {attachment.fileName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            type="button"
            onClick={onRemove}
            aria-label="Remover anexo"
          >
            <X size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
          </Button>
        </span>
      )}

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
          {attachment === null && !isLoading && (
            <Button variant="primary" size="sm" type="button" onClick={handlePick}>
              Escolher arquivo
            </Button>
          )}
          {attachment === null && (
            <StateView
              state={state}
              emptyMessage="Nenhum arquivo anexado ainda."
              render={() => null}
            />
          )}
          {attachment !== null && (
            // display:contents on each pair so dt/dd sit directly in the 2-col grid.
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-xs">
                <div className="contents">
                  <dt className="text-text-muted">Separador</dt>
                  <dd className="text-text [word-break:break-word]">
                    {attachment.delimiter === '\t' ? 'tabulação' : attachment.delimiter}
                  </dd>
                </div>
                <div className="contents">
                  <dt className="text-text-muted">Colunas</dt>
                  <dd className="text-text [word-break:break-word]">
                    {attachment.columns.length > 0 ? attachment.columns.join(', ') : '—'}
                  </dd>
                </div>
                <div className="contents">
                  <dt className="text-text-muted">Linhas</dt>
                  <dd className="text-text [word-break:break-word]">{attachment.rowCount}</dd>
                </div>
              </dl>
              <Button variant="secondary" size="sm" type="button" onClick={handlePick}>
                Escolher outro arquivo
              </Button>
            </>
          )}
        </div>
      </Popover>
    </>
  )
}

export default AttachButton
