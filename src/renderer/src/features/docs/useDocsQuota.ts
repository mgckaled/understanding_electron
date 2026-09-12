import { useQuery } from '@tanstack/react-query'
import type { DocsQuota } from '@shared/ipc'

export const DOCS_QUOTA_KEY = ['docs', 'quota'] as const

/**
 * What the service said was left, in the header of the last answer.
 *
 * @returns `null` while nothing has been asked this session — there is no
 *   endpoint that reports the quota without spending a call (D23I.7).
 */
export function useDocsQuota(): { quota: DocsQuota | null; loaded: boolean } {
  const { data, isPending } = useQuery({
    queryKey: DOCS_QUOTA_KEY,
    queryFn: () => window.api.docs.quota()
  })

  return { quota: data ?? null, loaded: !isPending }
}
