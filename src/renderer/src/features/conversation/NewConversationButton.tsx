import Button from '../../shared/ui/Button/Button'
import { useConversations } from './conversationsContext'

// Lives in the sidebar's nav region, above the list — the shape both reference
// apps use.
function NewConversationButton(): React.JSX.Element {
  const { create } = useConversations()

  return (
    <Button variant="secondary" onClick={() => create()}>
      Nova conversa
    </Button>
  )
}

export default NewConversationButton
