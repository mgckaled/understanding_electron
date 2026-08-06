import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/ipc'

function Versions(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    window.api.app
      .info()
      .then(setInfo)
      .catch(() => setError(true))
  }, [])

  if (error) return <p className="versions-error">Não foi possível carregar as versões.</p>
  if (!info) return <ul className="versions" />

  return (
    <ul className="versions">
      <li className="electron-version">Electron v{info.electron}</li>
      <li className="chrome-version">Chromium v{info.chrome}</li>
      <li className="node-version">Node v{info.node}</li>
    </ul>
  )
}

export default Versions
