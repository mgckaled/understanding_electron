import { docsPartOf } from '@core/ai/messages'
import type { DocsPart } from '@shared/ipc'
import Button from '../../shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { useActiveConversation } from '../conversation/conversationsContext'
import { useDocs } from './docsContext'
import { DocsIcon } from './icon'

// The third count beside the clip and the pen, never summed into either: an
// attachment came from the user, a draft from the conversation, and a
// consultation from OUTSIDE it. Three origins, three questions, three numbers.
//
// `aria-pressed` follows its two siblings (D23H.4). The APG would have
// `aria-expanded` here — a button that shows and hides a panel — and changing
// one of three is worse than three consistent ones; the swap is 23-J's.
function DocsCount(): React.JSX.Element | null {
  const conversation = useActiveConversation()
  const { viewing, view, stopViewing, close } = useDocs()

  // Read from the transcript rather than from a provider list: the transcript
  // IS where a consultation lives once attached, and a second list would be
  // free to disagree with it.
  const parts = (conversation?.messages ?? [])
    .map(docsPartOf)
    .filter((part): part is DocsPart => part !== null)

  // Absent, not disabled: a greyed button promises a capability this
  // conversation does not have (DF3B.2). A consultation still being composed
  // does not count — it is not in the transcript yet.
  if (parts.length === 0) return null

  const open = viewing !== null
  const newest = parts[parts.length - 1]

  // Counts every consultation, turned off included: one out of the resend is
  // still one this conversation made (DM-31).
  return (
    <Button
      variant="ghost"
      size="sm"
      className="flex-none"
      onClick={(event) => {
        if (open) {
          stopViewing()
          close()
        } else {
          view(newest, event.currentTarget)
        }
      }}
      aria-pressed={open}
      aria-label={`${open ? 'Fechar' : 'Abrir'} consultas de documentação (${parts.length})`}
    >
      <span className="flex items-center gap-2">
        <DocsIcon size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
        {parts.length}
      </span>
    </Button>
  )
}

export default DocsCount
