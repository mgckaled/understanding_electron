import Button from '../../shared/ui/Button/Button'
import { useConversations } from './conversationsContext'

/*
 * Lives in the sidebar's nav region, above the list — the shape both reference
 * apps use. Landed in step 4 rather than step 5 because step 4's own acceptance
 * is "create two conversations, talk in both, switch between them", and without
 * this there is no way to reach the second one.
 */
function NewConversationButton(): React.JSX.Element {
  const { create } = useConversations()

  return (
    <Button variant="secondary" onClick={() => create()}>
      Nova conversa
    </Button>
  )
}

export default NewConversationButton
