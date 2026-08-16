import { useId, useState } from 'react'
import { Plus, Table2, X } from 'lucide-react'
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

// The composer's "+" (plano 17 passo 1 — replaces the DS-5 clip; D16.6 keeps
// the trigger in the composer). The popover lists attachment categories in
// the same item shape as the conversation-list kebab menu
// (ConversationList.tsx): icon, then text, hover:bg-surface. Only "Dados
// tabulares" has a working option so far — "Imagens"/"Documentos" join in the
// steps that build their own extractor (D17.14 of plano 17: no menu item
// ships ahead of the function behind it). Once a dataset is attached, the
// popover switches to its schema view — unchanged from before this step.
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
        aria-label="Adicionar anexo"
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        <Plus size={ICON_SIZE.md} strokeWidth={ICON_STROKE} />
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
        {attachment === null ? (
          <div className="flex flex-col gap-3 p-1">
            {/* Same item shape as the conversation-list kebab menu
                (ConversationList.tsx): icon then text, hover:bg-surface — one
                surface below the popover's own bg-surface-raised, so a hover
                that reused bg-surface-raised here would be invisible.
                "Imagens"/"Documentos" join this list in the steps that build
                their own extractor (D17.14 of plano 17). */}
            {!isLoading && (
              <div className="flex min-w-[180px] flex-col gap-1">
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-3 rounded-md px-4 py-3 text-left font-ui text-xs text-text hover:bg-surface"
                  onClick={handlePick}
                >
                  <Table2 size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
                  Dados tabulares
                </button>
              </div>
            )}
            <StateView
              state={state}
              emptyMessage="Nenhum arquivo anexado ainda."
              render={() => null}
            />
          </div>
        ) : (
          <div className="flex w-[240px] flex-col gap-3 p-1">
            {/* display:contents on each pair so dt/dd sit directly in the 2-col grid. */}
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
          </div>
        )}
      </Popover>
    </>
  )
}

export default AttachButton
