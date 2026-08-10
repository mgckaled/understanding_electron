import { QueryClientProvider } from '@tanstack/react-query'
import AppShell from './app/AppShell'
import Sidebar from './app/Sidebar'
import Versions from './components/Versions'
import OpenDatasetPanel from './features/open-dataset/OpenDatasetPanel'
import ConversationList from './features/conversation/ConversationList'
import ConversationView from './features/conversation/ConversationView'
import ConversationsProvider from './features/conversation/ConversationsProvider'
import NewConversationButton from './features/conversation/NewConversationButton'
import SettingsProvider from './features/settings/SettingsProvider'
import Settings from './features/settings/Settings'
import { createQueryClient } from './shared/queryClient'

// Module level, so it is created once for the life of the window rather than on
// every render. It never appears inside a component beyond this line — reading
// and writing it is the hooks' job (D14.4).
const queryClient = createQueryClient()

/*
 * Composition only: which component goes in which slot (D13.1). The shell knows
 * regions, this file knows content — that split is what lets app/ never import
 * from features/, and what keeps the settings surface and the reviewable-steps
 * block of plano 18 out of the shell's source.
 *
 * The providers wrap the whole shell because both columns read from them: the
 * list lives in the sidebar and the view in the main region.
 */
function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <ConversationsProvider>
          <AppShell
            sidebar={
              <Sidebar
                nav={
                  <>
                    <NewConversationButton />
                    <Settings />
                  </>
                }
                content={
                  <>
                    <ConversationList />
                    <OpenDatasetPanel />
                  </>
                }
                footer={<Versions />}
              />
            }
            main={<ConversationView />}
          />
        </ConversationsProvider>
      </SettingsProvider>
    </QueryClientProvider>
  )
}

export default App
