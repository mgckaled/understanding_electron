import { ChevronRight, FileText } from 'lucide-react'
import type { DocumentPart } from '@shared/ipc'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { useArtifact } from '../artifact/artifactContext'

// What plano 17 draws in the transcript for a document attachment (D17.9), now
// a trigger rather than a disclosure (DF3A.6): the body moved to the side
// panel, so the chevron points RIGHT — the direction is what tells the user
// where the content is about to appear. The card survives as the conversation's
// own history, which is why it keeps its full header.
function DocumentCard({ part }: { part: DocumentPart }): React.JSX.Element {
  const { current, toggle } = useArtifact()
  const open = current?.id === part.hash

  return (
    <div
      className={`flex max-w-[80%] flex-col gap-3 rounded-lg border bg-surface-raised px-5 py-4 text-text ${
        open ? 'border-accent-text' : 'border-border'
      }`}
    >
      <button
        type="button"
        className="flex cursor-pointer items-center gap-3 text-left"
        onClick={(event) => toggle({ kind: 'document', id: part.hash, part }, event.currentTarget)}
        // Not `aria-expanded`: nothing expands here any more, and a label that
        // lies is worse than none.
        aria-current={open ? 'true' : undefined}
      >
        <FileText
          size={ICON_SIZE.md}
          strokeWidth={ICON_STROKE}
          className="flex-none text-text-muted"
        />
        <div className="flex min-w-[0px] flex-1 flex-col gap-1">
          <span className="overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap">
            {part.fileName}
          </span>
          <span className="text-xs text-text-muted">{part.format.toUpperCase()}</span>
        </div>
        <ChevronRight
          size={ICON_SIZE.sm}
          strokeWidth={ICON_STROKE}
          className="flex-none text-text-muted"
        />
      </button>
    </div>
  )
}

export default DocumentCard
