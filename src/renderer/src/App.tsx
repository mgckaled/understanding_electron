import AppShell from './app/AppShell'
import Sidebar from './app/Sidebar'
import Versions from './components/Versions'
import OpenDatasetPanel from './features/open-dataset/OpenDatasetPanel'
import AiChatPanel from './features/conversation/AiChatPanel'
import ConversationsProvider from './features/conversation/ConversationsProvider'
import styles from './App.module.css'

/*
 * Composition only: which component goes in which slot (D13.1). The shell knows
 * regions, this file knows content — that split is what lets app/ never import
 * from features/, and what keeps the settings surface and the reviewable-steps
 * block of plano 18 out of the shell's source.
 *
 * The template's welcome panel is gone. It exercised shell.openExternal, which
 * stays covered by the handler's own test and by security-boundary.spec.ts —
 * and MarkdownMessage is the real consumer now (D13.7).
 */
function App(): React.JSX.Element {
  return (
    // The provider wraps the whole shell because both columns read from it:
    // the list lives in the sidebar and the view in the main region.
    <ConversationsProvider>
      <AppShell
        sidebar={<Sidebar content={<OpenDatasetPanel />} footer={<Versions />} />}
        main={
          <div className={styles.conversation}>
            <AiChatPanel />
          </div>
        }
      />
    </ConversationsProvider>
  )
}

export default App
