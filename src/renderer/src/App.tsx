import { useState } from 'react'
import { APP_NAME } from '@shared/meta'
import Panel from './shared/ui/Panel/Panel'
import Toolbar from './shared/ui/Toolbar/Toolbar'
import Button from './shared/ui/Button/Button'
import Versions from './components/Versions'
import OpenDatasetPanel from './features/open-dataset/OpenDatasetPanel'
import AiChatPanel from './features/ai-chat/AiChatPanel'
import styles from './App.module.css'

function App(): React.JSX.Element {
  const [openError, setOpenError] = useState<string | null>(null)

  const openDocs = async (): Promise<void> => {
    const result = await window.api.shell.openExternal('https://electron-vite.org/')
    setOpenError(result.ok ? null : result.error.kind)
  }

  return (
    <div className={styles.app}>
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
  )
}

export default App
