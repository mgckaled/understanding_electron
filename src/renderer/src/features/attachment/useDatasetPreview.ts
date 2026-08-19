import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tableFromIPC, type Table } from 'apache-arrow'
import type { ViewState } from '../../shared/ui/state'

const PREVIEW_QUERY = 'SELECT * FROM dataset LIMIT 50'

function previewKey(hash: string): readonly [string, string, string] {
  return ['dataset', 'preview', hash] as const
}

/**
 * The dataset's first 50 rows, reusing the 18-B `dataset:query` channel
 * verbatim (D18C.2) — the row cap lives in `PREVIEW_QUERY` itself, not in a
 * channel parameter. No `reload`, unlike useAiModels: a hash addresses
 * content, not a mutable resource (D16.3), so the same hash never resolves
 * to different rows — `staleTime: Infinity` is already the query client's
 * default (queryClient.ts), so this relies on it rather than repeating it.
 */
export function useDatasetPreview(hash: string): ViewState<Table> {
  const { data, isPending, isError } = useQuery({
    queryKey: previewKey(hash),
    queryFn: () => window.api.dataset.query(hash, PREVIEW_QUERY)
  })

  return useMemo((): ViewState<Table> => {
    if (isPending) return { status: 'loading' }
    if (isError || data === undefined) {
      return { status: 'error', error: { kind: 'unknown', message: 'dataset:query' } }
    }
    if (!data.ok) return { status: 'error', error: data.error }
    const table = tableFromIPC(data.value)
    return table.numRows === 0 ? { status: 'empty' } : { status: 'ready', data: table }
  }, [data, isPending, isError])
}
