import { Paperclip } from 'lucide-react'
import Button from '../../shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { useArtifact } from './artifactContext'

// The panel's affordance in the conversation header (DF3B.1). One click has to
// reach content, so it opens the MOST RECENT artifact rather than a list — the
// conversation with a single attachment is the case that dominates, and the
// panel's own picker is how anyone with more switches.
//
// `aria-pressed`, not `aria-current`: this is a toggle, while a card's
// `aria-current` claims something else ("I am the one on screen").
function ArtifactCount(): React.JSX.Element | null {
  const { current, artifacts, toggle } = useArtifact()

  // Absent, not disabled: a greyed button promises a capability this
  // conversation does not have (DF3B.2).
  if (artifacts.length === 0) return null

  const newest = artifacts[artifacts.length - 1]
  const open = current !== null

  return (
    <Button
      variant="ghost"
      size="sm"
      className="ml-auto flex-none"
      onClick={(event) => toggle(open ? current : newest, event.currentTarget)}
      aria-pressed={open}
      aria-label={`${open ? 'Fechar' : 'Abrir'} anexos da conversa (${artifacts.length})`}
    >
      <span className="flex items-center gap-2">
        <Paperclip size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
        {artifacts.length}
      </span>
    </Button>
  )
}

export default ArtifactCount
