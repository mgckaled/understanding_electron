import { useMemo, useReducer, type ReactNode } from 'react'
import { conversationsReducer, initialConversationsState } from './conversations'
import { ConversationsContext } from './conversationsContext'

// React 19 lets the context itself be the provider — no `.Provider` suffix.
function ConversationsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, dispatch] = useReducer(conversationsReducer, initialConversationsState)
  const value = useMemo(() => ({ state, dispatch }), [state])

  return <ConversationsContext value={value}>{children}</ConversationsContext>
}

export default ConversationsProvider
