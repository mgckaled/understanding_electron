import { Plus } from 'lucide-react'
import Button from '../../shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { useConversations } from './conversationsContext'

type NewConversationButtonProps = {
  /** Icon-only, for the sidebar's collapsed rail (F2.4) — same `create()`,
   *  no room for a label at 44px wide. */
  compact?: boolean
}

// Lives in the sidebar's nav region, above the list — the shape both reference
// apps use.
function NewConversationButton({ compact = false }: NewConversationButtonProps): React.JSX.Element {
  const { create } = useConversations()

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="sm"
        shape="square"
        onClick={() => create()}
        aria-label="Nova conversa"
      >
        <Plus size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
      </Button>
    )
  }

  return (
    <Button variant="outline" className="w-full" onClick={() => create()}>
      {/* Button wraps ALL children in ONE span (for the loading spinner's
          invisible toggle) — its own gap-3 never applies between grandchildren,
          which is why "+Nova conversa" read glued together (DS-5 fixup). The
          gap has to live on this inner span instead. */}
      <span className="inline-flex items-center gap-2">
        <Plus size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} aria-hidden="true" />
        Nova conversa
      </span>
    </Button>
  )
}

export default NewConversationButton
