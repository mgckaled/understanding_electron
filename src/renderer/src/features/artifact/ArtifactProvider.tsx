import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { useActiveConversation, useConversations } from '../conversation/conversationsContext'
import { ArtifactContext, type ArtifactRef } from './artifactContext'
import { artifactsOf } from './artifactsOf'

// Window state, sibling of "sidebar collapsed" — never persisted (DF3A.5). It
// cannot live in the card: the card unmounts when the conversation changes, and
// the panel is precisely what has to notice that.
function ArtifactProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [current, setCurrent] = useState<ArtifactRef | null>(null)
  const { activeId } = useConversations()
  const conversation = useActiveConversation()
  const artifacts = artifactsOf(conversation?.messages ?? [])

  // The opener, kept out of state because focusing it renders nothing (DF3A.8).
  const trigger = useRef<HTMLElement | null>(null)

  // Focus goes back where it came from, or keyboard navigation opens the panel
  // and lands nowhere. Cleared after use so a later close does not steal focus
  // from wherever the user has moved on to.
  const close = useCallback(() => {
    setCurrent(null)
    trigger.current?.focus()
    trigger.current = null
  }, [])

  const toggle = useCallback((ref: ArtifactRef, opener: HTMLElement | null) => {
    trigger.current = opener
    setCurrent((open) => (open !== null && open.id === ref.id ? null : ref))
  }, [])

  // A different conversation is a different set of artifacts, and the panel is
  // not a destination that survives navigation. Adjusted DURING render, not in
  // an effect: React re-runs this pass before committing, so the panel never
  // paints once holding the previous conversation's artifact — and
  // `react-hooks/set-state-in-effect` rejects the effect form outright.
  // Not `close()`: the trigger card left with the old transcript, and focusing
  // a detached node would steal focus from whatever brought the user here.
  const [seenConversation, setSeenConversation] = useState(activeId)
  if (seenConversation !== activeId) {
    setSeenConversation(activeId)
    setCurrent(null)
  }

  const value = useMemo(
    () => ({ current, artifacts, toggle, close }),
    [current, artifacts, toggle, close]
  )

  return <ArtifactContext value={value}>{children}</ArtifactContext>
}

export default ArtifactProvider
