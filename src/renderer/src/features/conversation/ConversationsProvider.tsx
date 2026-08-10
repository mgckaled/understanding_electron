import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ConversationsContext } from './conversationsContext'

/*
 * All that is left here is CLIENT state: which conversation is selected. The
 * list and the transcripts moved to the server cache in plano 14, and the
 * reducer that used to hold them went with them — a client store holding server
 * data that goes stale with nobody knowing is the mistake D13.2 avoided.
 *
 * `null` is not "nothing selected": it means "no explicit choice", and the hook
 * resolves it to the most recent conversation (D14.6).
 */
// React 19 lets the context itself be the provider — no `.Provider` suffix.
function ConversationsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [selectedId, setSelected] = useState<string | null>(null)
  const setSelectedId = useCallback((id: string | null) => setSelected(id), [])
  const value = useMemo(() => ({ selectedId, setSelectedId }), [selectedId, setSelectedId])

  return <ConversationsContext value={value}>{children}</ConversationsContext>
}

export default ConversationsProvider
