import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppSettings } from '@shared/ipc'
import { DEFAULT_APP_SETTINGS } from '@shared/ipc'

/*
 * Machine-scale configuration, now on disk (D14.7). It used to live for the
 * session: the modal accepted a value and forgot it on close — a visible defect.
 *
 * There is no Context here any more, and no provider. Settings turned out to be
 * server cache in full: a value read from storage, written back, with no client
 * state left beside it. The shape of the hook is unchanged, which is why the
 * modal and the conversation view did not have to be.
 *
 * The type and the default moved to `shared/ipc.ts` — main needs both to fill
 * in a key the database has never seen.
 */

export type Settings = AppSettings
export const DEFAULT_SETTINGS = DEFAULT_APP_SETTINGS

const SETTINGS_KEY = ['settings'] as const

type SettingsApi = {
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
  /**
   * False until the stored value has arrived.
   *
   * It exists because a control that seeds its own state from `settings` on
   * mount — which is the right shape for a text field — would seed it from the
   * DEFAULT if it mounted first, and then show the wrong number with nothing on
   * screen suggesting anything is wrong. Callers that only READ `settings` can
   * ignore this; callers that COPY it into their own state must not.
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
