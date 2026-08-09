import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/ipc'
import styles from './Versions.module.css'

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
    <div className={styles.versions}>
      {error && <p className={styles.error}>Não foi possível carregar as versões.</p>}
      {!error && info && (
        <ul className={styles.list}>
          <li>Electron v{info.electron}</li>
          <li>Chromium v{info.chrome}</li>
          <li>Node v{info.node}</li>
        </ul>
      )}
    </div>
  )
}

export default Versions
