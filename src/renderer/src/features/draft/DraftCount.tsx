import { NotebookPen } from 'lucide-react'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { useDraft } from './draftContext'

// Its own count beside the clip, never summed into it: an attachment came from
// the user and a draft came from the conversation, and one number for both
// would answer neither question.
//
// Not a button yet, and not a disabled one: there is no panel to open until
// E-1-B, and a greyed control promises a capability that is not there — the
// same reasoning ArtifactPicker uses for a list of one.
function DraftCount(): React.JSX.Element | null {
  const { drafts } = useDraft()

  if (drafts.length === 0) return null

  return (
    <span
      className="flex flex-none items-center gap-2 px-3 font-ui text-sm text-text-muted"
      title={`${drafts.length} rascunho${drafts.length === 1 ? '' : 's'} nesta conversa`}
    >
      <NotebookPen size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
      {drafts.length}
    </span>
  )
}

export default DraftCount
