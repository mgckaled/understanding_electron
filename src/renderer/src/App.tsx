import { useState } from 'react'
import { APP_NAME } from '@shared/meta'
import AppShell from './app/AppShell'
import Sidebar from './app/Sidebar'
import Panel from './shared/ui/Panel/Panel'
import Toolbar from './shared/ui/Toolbar/Toolbar'
import Button from './shared/ui/Button/Button'
import Versions from './components/Versions'
import OpenDatasetPanel from './features/open-dataset/OpenDatasetPanel'
import AiChatPanel from './features/ai-chat/AiChatPanel'
import styles from './App.module.css'

// Composition only: which component goes in which slot. The shell knows
// regions, this file knows content, and that split is what keeps app/ from
// importing features/ (D13.1).
function App(): React.JSX.Element {
  const [openError, setOpenError] = useState<string | null>(null)

  const openDocs = async (): Promise<void> => {
    const result = await window.api.shell.openExternal('https://electron-vite.org/')
    setOpenError(result.ok ? null : result.error.kind)
  }

  return (
    <AppShell
      sidebar={<Sidebar />}
      main={
        <div className={styles.stack}>
          <Panel
            title={APP_NAME}
            actions={
              <Toolbar>
                <Button variant="primary" onClick={openDocs}>
                  Documentation
                </Button>
              </Toolbar>
            }
          >
            {openError && <p className={styles.error}>{openError}</p>}
            <p>Built with React and TypeScript.</p>
          </Panel>
          <OpenDatasetPanel />
          <AiChatPanel />
          <Versions />
        </div>
      }
    />
  )
}

export default App
