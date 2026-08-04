import { useState } from 'react'
import { APP_ID } from '@shared/meta'
import Versions from './components/Versions'
import electronLogo from './assets/electron.svg'

function App(): React.JSX.Element {
  const [openError, setOpenError] = useState<string | null>(null)

  const openDocs = async (): Promise<void> => {
    const result = await window.api.shell.openExternal('https://electron-vite.org/')
    setOpenError(result.ok ? null : result.error.kind)
  }

  return (
    <>
      <img alt="logo" className="logo" src={electronLogo} />
      <div className="creator">{APP_ID}</div>
      <div className="text">
        Build an Electron app with <span className="react">React</span>
        &nbsp;and <span className="ts">TypeScript</span>
      </div>
      <p className="tip">
        Please try pressing <code>F12</code> to open the devTool
      </p>
      <div className="actions">
        <div className="action">
          <button type="button" onClick={openDocs}>
            Documentation
          </button>
        </div>
      </div>
      {openError && <p className="tip">{openError}</p>}
      <Versions></Versions>
    </>
  )
}

export default App
