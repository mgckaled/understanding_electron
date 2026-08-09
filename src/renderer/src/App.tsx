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
  )
}

export default App
