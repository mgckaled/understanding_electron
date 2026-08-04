import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/ipc'

function Versions(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    window.api.app.info().then(setInfo)
  }, [])

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
