import type { DocsQuota } from '@shared/ipc'

/**
 * What the last answer of this session reported about the quota (D23I.7).
 *
 * A session memo like the answer cache beside it: the number is only ever as
 * fresh as the last call, there is no endpoint that reports it on demand, and
 * a restart honestly knows nothing again.
 */
export type QuotaMemo = {
  record(quota: DocsQuota): void
  read(): DocsQuota | null
}

export function createQuotaMemo(): QuotaMemo {
  let last: DocsQuota | null = null
  return {
    // An answer whose header carried nothing readable leaves the previous
    // number standing: it is still the most recent thing the service said.
    record: (quota) => {
      if (quota.limit !== null || quota.remaining !== null) last = quota
    },
    read: () => last
  }
}
