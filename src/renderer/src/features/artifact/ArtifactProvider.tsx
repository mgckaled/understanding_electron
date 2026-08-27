import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useActiveConversation, useConversations } from '../conversation/conversationsContext'
import { ArtifactContext, type ArtifactRef } from './artifactContext'
import { artifactsOf } from './artifactsOf'
import { DEFAULT_WIDTH } from '../../shared/ui/SidePanel/panelWidth'

// Mirrors --duration-base: the unmount is scheduled in JS, and CSS cannot
// delay it (DF3C.1).
const FADE_MS = 200

function isTyping(element: HTMLElement): boolean {
  return element.isContentEditable || element.tagName === 'TEXTAREA' || element.tagName === 'INPUT'
}

// Window state, sibling of "sidebar collapsed" — never persisted (DF3A.5). It
// cannot live in the card: the card unmounts when the conversation changes, and
// the panel is precisely what has to notice that.
type ArtifactProviderProps = {
  children: ReactNode
  /** Called when the panel goes from closed to open, so the shell can free room (DF3C.3). */
  onOpen?: () => void
}

function ArtifactProvider({ children, onOpen }: ArtifactProviderProps): React.JSX.Element {
  const [current, setCurrent] = useState<ArtifactRef | null>(null)
  const [proposalId, setProposalId] = useState<string | null>(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
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
  const [closing, setClosing] = useState(false)
  const fade = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelFade = useCallback(() => {
    if (fade.current !== null) clearTimeout(fade.current)
    fade.current = null
    setClosing(false)
  }, [])

  useEffect(() => () => (fade.current === null ? undefined : clearTimeout(fade.current)), [])

  const close = useCallback(() => {
    // Before the fade ends: 200ms of focus on a leaving element is a lost Tab.
    trigger.current?.focus()
    trigger.current = null
    setClosing(true)
    if (fade.current !== null) clearTimeout(fade.current)
    fade.current = setTimeout(() => {
      fade.current = null
      setClosing(false)
      setCurrent(null)
    }, FADE_MS)
  }, [])

  const toggle = useCallback(
    (ref: ArtifactRef, opener: HTMLElement | null, proposal?: string) => {
      // While closing, the same artifact reopens instead of toggling shut.
      if (current !== null && current.id === ref.id && !closing) {
        close()
        return
      }
      cancelFade()
      trigger.current = opener
      setProposalId(proposal ?? null)
      if (current === null) onOpen?.()
      setCurrent(ref)
    },
    [current, closing, close, cancelFade, onOpen]
  )

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
    // No fade: navigation is not a close.
    setCurrent(null)
    setClosing(false)
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
    () => ({
      current,
      closing,
      width,
      setWidth,
      artifacts,
      proposalId,
      toggle,
      togglePanel,
      close
    }),
    [current, closing, width, artifacts, proposalId, toggle, togglePanel, close]
  )

  return <ArtifactContext value={value}>{children}</ArtifactContext>
}

export default ArtifactProvider
