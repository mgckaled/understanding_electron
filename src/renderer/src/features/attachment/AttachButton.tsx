import { useId, useState } from 'react'
import { BookOpen, Code2, FileText, Globe, Image, Lightbulb, Plus, Table2, X } from 'lucide-react'
import type { AiModel, AttachmentPart } from '@shared/ipc'
import { hasCapability } from '@core/ai/models'
import { estimateReadSeconds } from '@core/document/estimate'
import Button from '../../shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Popover from '../../shared/ui/Popover/Popover'
import { toAnchorName } from '../../shared/ui/Popover/anchorName'
import StateView from '../../shared/ui/StateView'
import Switch from '../../shared/ui/Switch/Switch'
import { useAttachFile } from './useAttachFile'

// The three switches mirror ESCOPO.md § Ferramentas do chat (planos 21-23,
// dentro do arco) — same Portuguese names as the product's single source, not
// the rascunho's placeholder English ones. `kind` is what a caller flips
// (F2.6): 'reasoning' left this row alone, the other two stay off and
// disabled — arcos 22/23, still unbuilt.
const TOOLS = [
  { label: 'Busca web', Icon: Globe, kind: 'webSearch' },
  { label: 'Raciocínio visível', Icon: Lightbulb, kind: 'reasoning' },
  { label: 'Documentação (MCP)', Icon: BookOpen, kind: 'mcp' }
] as const

// A group label, same shape as the date headings in ConversationList.
const GROUP_LABEL = 'px-4 text-2xs font-semibold tracking-[0.04em] text-text-faint uppercase'

type AttachButtonProps = {
  /** The pending attachment, or null. Controlled — Composer holds it next to `draft` (D13.2, D16.6, generalized D17.4). */
  attachment: AttachmentPart | null
  onAttached: (part: AttachmentPart) => void
  onRemove: () => void
  disabled?: boolean
  /** The conversation's resolved model, for the vision gate (D17.11) — null disables "Imagens". */
  model?: AiModel | null
  /** The "Raciocínio visível" switch (arco 21, D21A.5) — undefined/no-op until the caller wires it. */
  wantsReasoning?: boolean
  onWantsReasoningChange?: (value: boolean) => void
}

const DEFAULT_LABEL = 'Lendo arquivo…'

// The composer's "+" (plano 17 passo 1 — replaces the DS-5 clip; D16.6 keeps
// the trigger in the composer). The popover lists attachment categories in
// the same item shape as the conversation-list kebab menu
// (ConversationList.tsx): icon, then text, hover:bg-surface. One
// useAttachFile instance drives all three categories (D17.4): `api` is
// chosen per click, not baked into the hook, so the composer's single
// pending slot has a single state machine.
function AttachButton({
  attachment,
  onAttached,
  onRemove,
  disabled = false,
  model = null,
  wantsReasoning = false,
  onWantsReasoningChange = () => {}
}: AttachButtonProps): React.JSX.Element {
  const { state, pick, cancel } = useAttachFile<AttachmentPart>(onAttached)
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(DEFAULT_LABEL)
  const anchorName = toAnchorName(useId())
  const isLoading = state.status === 'loading'
  // The gate's compose-side check (D17.11) — the other lives in Composer's
  // canSend, both calling the same hasCapability the docstring promises.
  const hasVision = model !== null && hasCapability(model, 'vision')
  const hasThinking = model !== null && hasCapability(model, 'thinking')

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

  // Fixed "~80s" (D17.10) — unlike document, the cost does not depend on file
  // size, so there is nothing to estimate from before the job opens.
  const handlePickImage = (): void => {
    setOpen(false)
    setLabel('Lendo imagem… ~80s')
    void pick(window.api.image)
  }

  const handlePickAgain =
    attachment?.kind === 'image'
      ? handlePickImage
      : attachment?.kind === 'document'
        ? handlePickDocument
        : handlePickDataset

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
        aria-expanded={open}
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
                "Imagens" is fully wired (channel, extractor, protocol, card)
                and only turns grey by real state — a disabled, implemented
                control, not a stub (D17.11, distinct from the ban on
                shipping a menu item with no function behind it). */}
            {!isLoading && (
              <div className="flex min-w-[220px] flex-col gap-1">
                <p className={GROUP_LABEL}>Arquivos</p>
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
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-3 rounded-md px-4 py-3 text-left font-ui text-xs text-text hover:bg-surface disabled:cursor-not-allowed disabled:text-text-faint disabled:hover:bg-transparent"
                  onClick={handlePickImage}
                  disabled={!hasVision}
                >
                  <Image size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
                  Imagens
                </button>
                {/* A `title` on a disabled control is not a reliable surface —
                    Chromium's own tooltip machinery may not fire on it, and it
                    is invisible to a test. This line is the actual hint
                    (D17.11 — the plan's one required explanation). Sits right
                    under Imagens, not after Código (advisor review: the two
                    disabled items back to back read the hint as Código's,
                    not Imagens'). */}
                {!hasVision && (
                  <p className="px-4 text-2xs text-text-muted">
                    O modelo atual não processa imagens.
                  </p>
                )}
                {/* Unconditionally disabled — unlike Imagens, no capability
                    gates it. The extractor exists for prose (ESCOPO.md linha
                    236) but document:pick's OS dialog filters only
                    txt/md/pdf, so no source file reaches it yet — a future
                    plano, not a stub with nothing behind it (F2.8). */}
                <button
                  type="button"
                  className="flex cursor-not-allowed items-center gap-3 rounded-md px-4 py-3 text-left font-ui text-xs text-text-faint"
                  disabled
                >
                  <Code2 size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
                  Código
                </button>
                <div className="my-1 border-t border-border" />
                <p className={GROUP_LABEL}>Ferramentas</p>
                {TOOLS.map(({ label, Icon, kind }) => (
                  <div key={label} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="flex items-center gap-3 text-xs text-text-faint">
                      <Icon size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
                      {label}
                    </span>
                    {/* 'webSearch'/'mcp' stay off and disabled (F2.6, arcos
                        22/23 unbuilt). 'reasoning' is destravado (D21A.5). */}
                    <Switch
                      checked={kind === 'reasoning' ? wantsReasoning : false}
                      onChange={kind === 'reasoning' ? onWantsReasoningChange : () => {}}
                      disabled={kind === 'reasoning' ? !hasThinking : true}
                      aria-label={label}
                    />
                  </div>
                ))}
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
                  {/* Checked in this order on purpose (D18F.6): 'excel' first,
                      'json' second, and undefined/anything else falls into
                      this last Separador branch — never a switch that treats
                      undefined as its own case. A part stored before 18-E
                      comes back with format: undefined and must read like any
                      other CSV. */}
                  {attachment.format === 'excel' ? (
                    <div className="contents">
                      <dt className="text-text-muted">Formato</dt>
                      <dd className="text-text [word-break:break-word]">Excel</dd>
                    </div>
                  ) : attachment.format === 'json' ? (
                    <div className="contents">
                      <dt className="text-text-muted">Formato</dt>
                      <dd className="text-text [word-break:break-word]">JSON</dd>
                    </div>
                  ) : (
                    <div className="contents">
                      <dt className="text-text-muted">Separador</dt>
                      <dd className="text-text [word-break:break-word]">
                        {attachment.delimiter === '\t' ? 'tabulação' : attachment.delimiter}
                      </dd>
                    </div>
                  )}
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
              ) : attachment.kind === 'document' ? (
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
              ) : (
                <div className="contents">
                  <dt className="text-text-muted">Formato</dt>
                  <dd className="text-text [word-break:break-word]">
                    {attachment.mimeType === 'image/png' ? 'PNG' : 'JPEG'}
                  </dd>
                </div>
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
