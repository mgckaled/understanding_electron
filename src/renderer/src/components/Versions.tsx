import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/ipc'

// The sidebar footer — where Claude Desktop puts the user account (D13.7). A
// compact strip, no Panel: the sidebar already supplies the surface.
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
    <div className="text-text-faint">
      {error && <p className="text-warn-text">Não foi possível carregar as versões.</p>}
      {!error && info && (
        // Wraps rather than truncates: at the collapsed-adjacent widths the three
        // items do not fit on one line, and a clipped version number is worse
        // than a second line in a footer nobody scans.
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          <li>Electron v{info.electron}</li>
          <li>Chromium v{info.chrome}</li>
          <li>Node v{info.node}</li>
        </ul>
      )}
    </div>
  )
}

export default Versions
