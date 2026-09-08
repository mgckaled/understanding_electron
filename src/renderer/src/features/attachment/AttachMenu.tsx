import { Code2, FileText, Globe, Image, Lightbulb, Table2 } from 'lucide-react'
import Switch from '../../shared/ui/Switch/Switch'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { DocsIcon } from '../docs/icon'

// The `mcp` row is gone (D23D.5): capability is what the MODEL has, and
// consulting documentation is an action of the user's.
const TOOLS = [
  { label: 'Busca web', Icon: Globe, kind: 'webSearch' },
  { label: 'Raciocínio visível', Icon: Lightbulb, kind: 'reasoning' }
] as const

const GROUP_LABEL = 'px-4 text-2xs font-semibold tracking-[0.04em] text-text-faint uppercase'

const ITEM =
  'flex cursor-pointer items-center gap-3 rounded-md px-4 py-3 text-left font-ui text-xs text-text hover:bg-surface disabled:cursor-not-allowed disabled:text-text-faint disabled:hover:bg-transparent'

type AttachMenuProps = {
  /** A file is already pending: the three file categories lock, documentation never does (D23D.3). */
  hasAttachment: boolean
  hasVision: boolean
  hasThinking: boolean
  wantsReasoning: boolean
  onWantsReasoningChange: (value: boolean) => void
  onPickDataset: () => void
  onPickDocument: () => void
  onPickImage: () => void
  onConsultDocs: () => void
}

function AttachMenu({
  hasAttachment,
  hasVision,
  hasThinking,
  wantsReasoning,
  onWantsReasoningChange,
  onPickDataset,
  onPickDocument,
  onPickImage,
  onConsultDocs
}: AttachMenuProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <p className={GROUP_LABEL}>Anexos</p>
      <button type="button" className={ITEM} onClick={onPickDataset} disabled={hasAttachment}>
        <Table2 size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
        Dados tabulares
      </button>
      <button type="button" className={ITEM} onClick={onPickDocument} disabled={hasAttachment}>
        <FileText size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
        Documentos
      </button>
      <button
        type="button"
        className={ITEM}
        onClick={onPickImage}
        disabled={!hasVision || hasAttachment}
      >
        <Image size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
        Imagens
      </button>
      {/* Sits under Imagens, not after Código: two disabled items back to back
          read the hint as the second one's (D17.11). */}
      {!hasVision && (
        <p className="px-4 text-2xs text-text-muted">O modelo atual não processa imagens.</p>
      )}
      {/* No capability gates Código, and no plano has built it yet (F2.8). */}
      <button type="button" className={ITEM} disabled>
        <Code2 size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
        Código
      </button>
      {/* Never locked by a pending file: a consultation is not an attachment
          and does not compete for the composer's one slot (DM-23, D23D.3). */}
      <button type="button" className={ITEM} onClick={onConsultDocs}>
        <DocsIcon size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
        Documentação
        <span className="ml-auto text-2xs text-text-faint">Context7</span>
      </button>

      <div className="my-1 border-t border-border" />
      <p className={GROUP_LABEL}>Ferramentas</p>
      {TOOLS.map(({ label, Icon, kind }) => (
        <div key={label} className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-3 text-xs text-text-faint">
            <Icon size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
            {label}
          </span>
          <Switch
            checked={kind === 'reasoning' ? wantsReasoning && hasThinking : false}
            onChange={kind === 'reasoning' ? onWantsReasoningChange : () => {}}
            disabled={kind === 'reasoning' ? !hasThinking : true}
            aria-label={label}
          />
        </div>
      ))}
    </div>
  )
}

export default AttachMenu
