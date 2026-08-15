import { QueryClientProvider } from '@tanstack/react-query'
import AppShell from './app/AppShell'
import Sidebar from './app/Sidebar'
import OllamaStatus from './components/OllamaStatus'
import ConversationList from './features/conversation/ConversationList'
import ConversationView from './features/conversation/ConversationView'
import ConversationsProvider from './features/conversation/ConversationsProvider'
import NewConversationButton from './features/conversation/NewConversationButton'
import Settings from './features/settings/Settings'
import { createQueryClient } from './shared/queryClient'

// Module level, so it is created once for the life of the window rather than on
// every render. It never appears inside a component beyond this line — reading
// and writing it is the hooks' job (D14.4).
const queryClient = createQueryClient()

// Composition only: which component goes in which slot (D13.1). The shell knows
// regions, this file knows content — the split that lets app/ never import from
// features/ and keeps plano 18's blocks out of the shell's source. The providers
// wrap the whole shell because both columns read from them.
function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <ConversationsProvider>
        <AppShell
          sidebar={
            <Sidebar
              nav={<NewConversationButton />}
              // The "Abrir arquivo" section moved into the composer as the
              // clip (DS5, item 7) — the sidebar's content slot is
              // ConversationList alone now.
              content={<ConversationList />}
              footer={
                <div className="flex items-center justify-between gap-3">
                  <OllamaStatus />
                  <Settings />
                </div>
              }
            />
          }
          main={<ConversationView />}
        />
      </ConversationsProvider>
    </QueryClientProvider>
  )
}

export default App
