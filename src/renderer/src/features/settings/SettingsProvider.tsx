import { useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, SettingsContext, type Settings } from './settingsContext'

function SettingsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const value = useMemo(() => ({ settings, setSettings }), [settings])

  return <SettingsContext value={value}>{children}</SettingsContext>
}

export default SettingsProvider
