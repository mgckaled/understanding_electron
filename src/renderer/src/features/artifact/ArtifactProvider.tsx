import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useActiveConversation, useConversations } from '../conversation/conversationsContext'
import { ArtifactContext, type ArtifactRef } from './artifactContext'
import { artifactsOf } from './artifactsOf'

function isTyping(element: HTMLElement): boolean {
  return element.isContentEditable || element.tagName === 'TEXTAREA' || element.tagName === 'INPUT'
}

// Window state, sibling of "sidebar collapsed" — never persisted (DF3A.5). It
// cannot live in the card: the card unmounts when the conversation changes, and
// the panel is precisely what has to notice that.
function ArtifactProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [current, setCurrent] = useState<ArtifactRef | null>(null)
  const { activeId } = useConversations()
  const conversation = useActiveConversation()
  // Memoised on the transcript, not recomputed per render: without this the
  // context value is a new object every time and every consumer re-renders —
  // and the shortcut's listener would re-register on each one.
  const messages = conversation?.messages
  const artifacts = useMemo(() => artifactsOf(messages ?? []), [messages])

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

  const togglePanel = useCallback(
    (opener: HTMLElement | null) => {
      const target = current ?? artifacts[artifacts.length - 1]
      if (target !== undefined) toggle(target, opener)
    },
    [current, artifacts, toggle]
  )

  // Ctrl+B, listened for in the RENDERER (DF3B.3): globalShortcut would fire
  // with the app unfocused, and a menu accelerator would need an application
  // menu this app does not build. Never while typing — an accelerator that
  // fires mid-sentence is worse than none.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (!event.ctrlKey || event.altKey || event.shiftKey) return
      if (event.key.toLowerCase() !== 'b') return
      const target = event.target
      if (target instanceof HTMLElement && isTyping(target)) return
      event.preventDefault()
      togglePanel(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePanel])

  const value = useMemo(
    () => ({ current, artifacts, toggle, togglePanel, close }),
    [current, artifacts, toggle, togglePanel, close]
  )

  return <ArtifactContext value={value}>{children}</ArtifactContext>
}

export default ArtifactProvider
