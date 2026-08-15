import { Plus } from 'lucide-react'
import Button from '../../shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { useConversations } from './conversationsContext'

// Lives in the sidebar's nav region, above the list — the shape both reference
// apps use.
function NewConversationButton(): React.JSX.Element {
  const { create } = useConversations()

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
