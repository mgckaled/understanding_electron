import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tableFromIPC, type Table } from 'apache-arrow'
import type { ViewState } from '../../shared/ui/state'

export const DEFAULT_PREVIEW_ROWS = 50

function previewKey(hash: string, rows: number): readonly [string, string, string, number] {
  return ['dataset', 'preview', hash, rows] as const
}

/**
 * The dataset's first rows, reusing the 18-B `dataset:query` channel verbatim
 * (D18C.2) — the row cap lives in the SQL itself, not in a channel parameter.
 * No `reload`, unlike useAiModels: a hash addresses content, not a mutable
 * resource (D16.3), so the same hash never resolves to different rows —
 * `staleTime: Infinity` is already the query client's default (queryClient.ts),
 * so this relies on it rather than repeating it.
 *
 * @param rows - How many to ask for. Interpolated into the SQL, so it must
 *   come from `PAGE_SIZES` and never from free input (D18B.3).
 */
export function useDatasetPreview(hash: string, rows = DEFAULT_PREVIEW_ROWS): ViewState<Table> {
  const { data, isPending, isError } = useQuery({
    queryKey: previewKey(hash, rows),
    queryFn: () => window.api.dataset.query(hash, `SELECT * FROM dataset LIMIT ${rows}`)
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
