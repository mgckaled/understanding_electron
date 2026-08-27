import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useActiveConversation, useConversations } from '../conversation/conversationsContext'
import { usePanel } from '../panel/panelContext'
import { ArtifactContext, type ArtifactRef } from './artifactContext'
import { artifactsOf } from './artifactsOf'

// Window state, sibling of "sidebar collapsed" — never persisted (DF3A.5). It
// cannot live in the card: the card unmounts when the conversation changes, and
// the panel is precisely what has to notice that. Which artifact is selected
// lives here; whether it has the screen belongs to the panel region (DE1B.1).
function ArtifactProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [current, setCurrent] = useState<ArtifactRef | null>(null)
  const [proposalId, setProposalId] = useState<string | null>(null)
  const { showing, raise, toggle: toggleRegion, close, release, onShortcut } = usePanel()
  const { activeId } = useConversations()
  const conversation = useActiveConversation()
  // Memoised on the transcript, not recomputed per render: without this the
  // context value is a new object every time and every consumer re-renders.
  const messages = conversation?.messages
  const artifacts = useMemo(() => artifactsOf(messages ?? []), [messages])

  const open = showing === 'artifact' ? current : null

  const toggle = useCallback(
    (ref: ArtifactRef, opener: HTMLElement | null, proposal?: string) => {
      setProposalId(proposal ?? null)
      setCurrent(ref)
      if (open !== null && open.id === ref.id) toggleRegion('artifact', opener)
      else raise('artifact', opener)
    },
    [open, raise, toggleRegion]
  )

  // A different conversation is a different set of artifacts, and the panel is
  // not a destination that survives navigation. Adjusted DURING render, not in
  // an effect: React re-runs this pass before committing, so the panel never
  // paints once holding the previous conversation's artifact — and
  // `react-hooks/set-state-in-effect` rejects the effect form outright.
  const [seenConversation, setSeenConversation] = useState(activeId)
  if (seenConversation !== activeId) {
    setSeenConversation(activeId)
    setCurrent(null)
  }

  // Navigation empties the selection during render; the region cannot be told
  // from there (setState of another component while rendering is an error), so
  // it is released here instead of lingering marked as ours with nothing in it.
  useEffect(() => {
    if (showing === 'artifact' && current === null) release()
  }, [showing, current, release])

  const togglePanel = useCallback(
    (opener: HTMLElement | null) => {
      const target = current ?? artifacts[artifacts.length - 1]
      if (target !== undefined) toggle(target, opener)
    },
    [current, artifacts, toggle]
  )

  // Ctrl+B, listened for in the RENDERER (DF3B.3): globalShortcut would fire
  // with the app unfocused, and a menu accelerator would need an application
  // menu this app does not build.
  useEffect(() => {
    onShortcut('artifact', () => togglePanel(null))
  }, [onShortcut, togglePanel])

  const value = useMemo(
    () => ({ current: open, artifacts, proposalId, toggle, togglePanel, close }),
    [open, artifacts, proposalId, toggle, togglePanel, close]
  )

  return <ArtifactContext value={value}>{children}</ArtifactContext>
}

export default ArtifactProvider
