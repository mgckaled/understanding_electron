import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnProfile } from '@shared/ipc'
import type { ViewState } from '../../shared/ui/state'

function profileKey(hash: string): readonly [string, string, string] {
  return ['dataset', 'profile', hash] as const
}

/**
 * The dataset's level-2 profile, computed only once its disclosure opens
 * (D18D.6) — `enabled` gates the query so a card nobody expanded never pays
 * for `SUMMARIZE`. `staleTime: Infinity` is the query client's default
 * (`queryClient.ts`), reused for the same reason as `useDatasetPreview`: a
 * hash addresses immutable content (D16.3).
 */
export function useDatasetProfile(hash: string, enabled: boolean): ViewState<ColumnProfile[]> {
  const { data, isPending, isError } = useQuery({
    queryKey: profileKey(hash),
    queryFn: () => window.api.dataset.profile(hash),
    enabled
  })

  return useMemo((): ViewState<ColumnProfile[]> => {
    if (!enabled) return { status: 'idle' }
    if (isPending) return { status: 'loading' }
    if (isError || data === undefined) {
      return { status: 'error', error: { kind: 'unknown', message: 'dataset:profile' } }
    }
    if (!data.ok) return { status: 'error', error: data.error }
    return { status: 'ready', data: data.value }
  }, [data, isPending, isError, enabled])
}
