import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppSettings } from '@shared/ipc'
import { DEFAULT_APP_SETTINGS } from '@shared/ipc'

// Machine-scale configuration, now on disk (D14.7): it used to be forgotten on
// modal close. No Context or provider any more — settings turned out to be pure
// server cache (read from storage, written back), and the hook's shape is
// unchanged, so the modal and view did not change. Type and default live in
// `shared/ipc.ts`, which main needs to fill a key the DB has never seen.

export type Settings = AppSettings
export const DEFAULT_SETTINGS = DEFAULT_APP_SETTINGS

const SETTINGS_KEY = ['settings'] as const

type SettingsApi = {
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
  /**
   * False until the stored value has arrived. A control that seeds its own state
   * from `settings` on mount (right for a text field) would seed the DEFAULT if
   * it mounted first and show the wrong number. Callers that only READ `settings`
   * can ignore this; callers that COPY it must not.
   */
  loaded: boolean
}

export function useSettings(): SettingsApi {
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: SETTINGS_KEY, queryFn: () => window.api.settings.read() })
  const settings = data ?? DEFAULT_SETTINGS
  const loaded = data !== undefined

  const write = useMutation({
    scope: { id: 'settings' },
    mutationFn: (patch: Partial<Settings>) => window.api.settings.write(patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY })
  })

  // Keeping the SetStateAction signature is not nostalgia: the field commits
  // with `(previous) => ({ ...previous, numThread })`, and that reads the same
  // whether the previous value came from useState or from the database.
  const setSettings = useCallback(
    (action: SetStateAction<Settings>): void => {
      write.mutate(typeof action === 'function' ? action(settings) : action)
    },
    [settings, write]
  )

  return useMemo(() => ({ settings, setSettings, loaded }), [settings, setSettings, loaded])
}
