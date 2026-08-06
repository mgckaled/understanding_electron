import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/ipc'
import Panel from '../shared/ui/Panel/Panel'

function Versions(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    window.api.app
      .info()
      .then(setInfo)
      .catch(() => setError(true))
  }, [])

  return (
    <Panel title="Versions">
      {error && <p>Não foi possível carregar as versões.</p>}
      {!error && info && (
        <ul>
          <li>Electron v{info.electron}</li>
          <li>Chromium v{info.chrome}</li>
          <li>Node v{info.node}</li>
        </ul>
      )}
    </Panel>
  )
}

export default Versions
