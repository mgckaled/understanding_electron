import { useId, useState } from 'react'
import { FileText, Plus, Table2, X } from 'lucide-react'
import type { AttachmentPart } from '@shared/ipc'
import { estimateReadSeconds } from '@core/document/estimate'
import Button from '../../shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Popover from '../../shared/ui/Popover/Popover'
import { toAnchorName } from '../../shared/ui/Popover/anchorName'
import StateView from '../../shared/ui/StateView'
import { useAttachFile } from './useAttachFile'

type AttachButtonProps = {
  /** The pending attachment, or null. Controlled — Composer holds it next to `draft` (D13.2, D16.6, generalized D17.4). */
  attachment: AttachmentPart | null
  onAttached: (part: AttachmentPart) => void
  onRemove: () => void
  disabled?: boolean
}

const DEFAULT_LABEL = 'Lendo arquivo…'

// The composer's "+" (plano 17 passo 1 — replaces the DS-5 clip; D16.6 keeps
// the trigger in the composer). The popover lists attachment categories in
// the same item shape as the conversation-list kebab menu
// (ConversationList.tsx): icon, then text, hover:bg-surface. "Imagens" joins
// once its extractor exists (D17.14: no menu item ships ahead of the
// function behind it). One useAttachFile instance drives both categories
// (D17.4): `api` is chosen per click, not baked into the hook, so the
// composer's single pending slot has a single state machine.
function AttachButton({
  attachment,
  onAttached,
  onRemove,
  disabled = false
}: AttachButtonProps): React.JSX.Element {
  const { state, pick, cancel } = useAttachFile<AttachmentPart>(onAttached)
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(DEFAULT_LABEL)
  const anchorName = toAnchorName(useId())
  const isLoading = state.status === 'loading'

  const handlePickDataset = (): void => {
    setOpen(false)
    setLabel(DEFAULT_LABEL)
    void pick(window.api.dataset)
  }

  // The estimate (D17.10) arrives via onPicked, once the main process has
  // stat'd the file — before the attach job opens, so the label never shows
  // the generic text first and then jumps.
  const handlePickDocument = (): void => {
    setOpen(false)
    setLabel('Lendo documento…')
    void pick(window.api.document, (ref) => {
      if (ref.sizeBytes !== undefined) {
        setLabel(`Lendo documento… ~${estimateReadSeconds(ref.sizeBytes)}s`)
      }
    })
  }

  const handlePickAgain = attachment?.kind === 'document' ? handlePickDocument : handlePickDataset

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
          <span>{label}</span>
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
                "Imagens" joins this list in the step that builds its own
                extractor (D17.14 of plano 17). */}
            {!isLoading && (
              <div className="flex min-w-[180px] flex-col gap-1">
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-3 rounded-md px-4 py-3 text-left font-ui text-xs text-text hover:bg-surface"
                  onClick={handlePickDataset}
                >
                  <Table2 size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
                  Dados tabulares
                </button>
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-3 rounded-md px-4 py-3 text-left font-ui text-xs text-text hover:bg-surface"
                  onClick={handlePickDocument}
                >
                  <FileText size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
                  Documentos
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
              {attachment.kind === 'dataset' ? (
                <>
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
                </>
              ) : (
                <>
                  <div className="contents">
                    <dt className="text-text-muted">Formato</dt>
                    <dd className="text-text [word-break:break-word]">
                      {attachment.format.toUpperCase()}
                    </dd>
                  </div>
                  <div className="contents">
                    <dt className="text-text-muted">Tamanho</dt>
                    <dd className="text-text [word-break:break-word]">
                      {attachment.text.length.toLocaleString('pt-BR')} caracteres
                    </dd>
                  </div>
                </>
              )}
            </dl>
            <Button variant="secondary" size="sm" type="button" onClick={handlePickAgain}>
              Escolher outro arquivo
            </Button>
          </div>
        )}
      </Popover>
    </>
  )
}

export default AttachButton
