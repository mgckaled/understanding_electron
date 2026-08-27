import { NotebookPen } from 'lucide-react'
import Button from '../../shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { useDraft } from './draftContext'

// Its own count beside the clip, never summed into it: an attachment came from
// the user and a draft came from the conversation, and one number for both
// would answer neither question.
//
// `aria-pressed`, not `aria-current`: this is a toggle, while a card's
// `aria-current` claims something else ("I am the one on screen").
function DraftCount(): React.JSX.Element | null {
  const { drafts, current, togglePanel } = useDraft()

  // Absent, not disabled: a greyed button promises a capability this
  // conversation does not have (DF3B.2).
  if (drafts.length === 0) return null

  const open = current !== null

  return (
    <Button
      variant="ghost"
      size="sm"
      className="flex-none"
      onClick={(event) => togglePanel(event.currentTarget)}
      aria-pressed={open}
      aria-label={`${open ? 'Fechar' : 'Abrir'} rascunhos da conversa (${drafts.length})`}
    >
      <span className="flex items-center gap-2">
        <NotebookPen size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
        {drafts.length}
      </span>
    </Button>
  )
}

export default DraftCount
