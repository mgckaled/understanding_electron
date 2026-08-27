import { QueryClientProvider } from '@tanstack/react-query'
import { MessageSquare, Search } from 'lucide-react'
import AppShell from './app/AppShell'
import Sidebar from './app/Sidebar'
import { useSidebarSpace } from './app/sidebarSpace'
import OllamaStatus from './components/OllamaStatus'
import ConversationList from './features/conversation/ConversationList'
import ConversationView from './features/conversation/ConversationView'
import ArtifactPanel from './features/artifact/ArtifactPanel'
import ArtifactProvider from './features/artifact/ArtifactProvider'
import PanelProvider from './features/panel/PanelProvider'
import ConversationsProvider from './features/conversation/ConversationsProvider'
import NewConversationButton from './features/conversation/NewConversationButton'
import Settings from './features/settings/Settings'
import { createQueryClient } from './shared/queryClient'
import Button from './shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from './shared/ui/icon'

// Module level, so it is created once for the life of the window rather than on
// every render. It never appears inside a component beyond this line — reading
// and writing it is the hooks' job (D14.4).
const queryClient = createQueryClient()

// Composition only: which component goes in which slot (D13.1). The shell knows
// regions, this file knows content — the split that lets app/ never import from
// features/ and keeps plano 18's blocks out of the shell's source. The providers
// wrap the whole shell because both columns read from them.
function App(): React.JSX.Element {
  const { collapsed, setCollapsed, makeRoom } = useSidebarSpace()

  return (
    <QueryClientProvider client={queryClient}>
      <ConversationsProvider>
        <PanelProvider onOpen={makeRoom}>
          <ArtifactProvider>
          <AppShell
            sidebarCollapsed={collapsed}
            sidebar={
              <Sidebar
                collapsed={collapsed}
                onCollapsedChange={setCollapsed}
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
                // The rail: direct action where one exists ("+" creates now,
                // Configurações opens now — a second `Settings` instance, fully
                // self-contained, so no state is lifted); Busca/Conversas only
                // expand, since 44px has no room to show what they would open
                // (F2.4). Configurações sits at the bottom (`mt-auto`), mirroring
                // its footer position in the expanded sidebar — the other three
                // are top actions, not siblings of a settings gear.
                collapsedRail={(expand) => (
                  <>
                    <NewConversationButton compact />
                    <Button
                      variant="ghost"
                      size="sm"
                      shape="square"
                      onClick={expand}
                      aria-label="Buscar conversas"
                    >
                      <Search size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      shape="square"
                      onClick={expand}
                      aria-label="Ver conversas"
                    >
                      <MessageSquare size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
                    </Button>
                    <div className="mt-auto">
                      <Settings />
                    </div>
                  </>
                )}
              />
            }
            main={<ConversationView />}
            artifact={<ArtifactPanel />}
          />
          </ArtifactProvider>
        </PanelProvider>
      </ConversationsProvider>
    </QueryClientProvider>
  )
}

export default App
