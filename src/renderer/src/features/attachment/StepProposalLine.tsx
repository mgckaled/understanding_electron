import { ChevronRight, ListChecks } from 'lucide-react'
import type { StepProposalPart } from '@shared/ipc'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { useArtifact } from '../artifact/artifactContext'

/**
 * A model's step proposal, as one line in the transcript (DF3F.1).
 *
 * It stays in the conversation because it IS the assistant's reply — dropping
 * it would leave the message alive in the database, resent to the model as
 * context, and invisible on screen. The editing moved to the panel's Passos tab.
 *
 * @param messageId - Which proposal the tab should show (DF3F.2).
 */
function StepProposalLine({
  part,
  messageId
}: {
  part: StepProposalPart
  messageId: string
}): React.JSX.Element {
  const { current, artifacts, toggle } = useArtifact()
  const target = artifacts.find((ref) => ref.id === part.hash)
  const count = `${part.steps.length} passo${part.steps.length === 1 ? '' : 's'}`

  // The dataset's own message can be deleted while this one survives. With no
  // artifact there is nothing to open, so the line stops being a control
  // rather than opening an empty panel.
  if (target === undefined) {
    return (
      <p className="flex items-center gap-3 text-sm text-text-faint">
        <ListChecks size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} className="flex-none" />
        Propus {count} para um arquivo que não está mais nesta conversa.
      </p>
    )
  }

  const open = current?.id === part.hash

  return (
    <button
      type="button"
      className={`flex max-w-[80%] cursor-pointer items-center gap-3 rounded-lg border px-5 py-3 text-left text-sm text-text ${
        open ? 'border-accent-text' : 'border-border hover:border-border-strong'
      }`}
      onClick={(event) => toggle(target, event.currentTarget, messageId)}
      aria-current={open ? 'true' : undefined}
    >
      <ListChecks
        size={ICON_SIZE.sm}
        strokeWidth={ICON_STROKE}
        className="flex-none text-text-muted"
      />
      <span className="min-w-[0px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
        Propus {count} para {target.part.fileName}
      </span>
      <ChevronRight
        size={ICON_SIZE.sm}
        strokeWidth={ICON_STROKE}
        className="flex-none text-text-muted"
      />
    </button>
  )
}

export default StepProposalLine
