/** What `measureChatTiming` hands to whoever persists it (O-7, § 9.2). */
export type PerformanceEvent = {
  service: string
  model: string
  evalTokens: number
  ttftMs: number
  decodeMs: number
  loadDurationMs?: number
  promptEvalDurationMs?: number
  nativeEvalDurationMs?: number
}

export type PerformanceRow = PerformanceEvent & { id: number; createdAt: number }

export type PerformanceSummary = {
  service: string
  model: string
  n: number
  avgTokensPerSec: number
  medianTokensPerSec: number
  p90TokensPerSec: number
  avgLoadDurationMs: number | null
}

// null, never Infinity/NaN (DO7.8): a decode window of ~0ms is a degenerate
// sample, and a fabricated four-digit rate would drag the bucket's average
// further than dropping the sample does.
function tokensPerSec(row: PerformanceRow): number | null {
  return row.decodeMs > 0 ? row.evalTokens / (row.decodeMs / 1000) : null
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.floor(p * sorted.length))
  return sorted[index]
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/**
 * Groups raw rows by `(service, model)` and computes n/avg/median/p90 of
 * tokens/s per bucket (O-7, DO7.5) — the summary is derived here, never a
 * second table kept in sync with `performance_events`.
 *
 * @returns One entry per bucket that has at least one measurable rate; a
 *   bucket where every row had a zero decode window is omitted rather than
 *   reported with fabricated numbers.
 */
export function summarizeByModel(rows: PerformanceRow[]): PerformanceSummary[] {
  const buckets = new Map<string, PerformanceRow[]>()
  for (const row of rows) {
    const key = `${row.service}:${row.model}`
    buckets.set(key, [...(buckets.get(key) ?? []), row])
  }

  const summaries: PerformanceSummary[] = []
  for (const bucket of buckets.values()) {
    const rates = bucket
      .map(tokensPerSec)
      .filter((rate): rate is number => rate !== null)
      .sort((a, b) => a - b)
    if (rates.length === 0) continue

    const loads = bucket
      .map((row) => row.loadDurationMs)
      .filter((ms): ms is number => ms !== undefined)

    summaries.push({
      service: bucket[0].service,
      model: bucket[0].model,
      n: rates.length,
      avgTokensPerSec: average(rates),
      medianTokensPerSec: percentile(rates, 0.5),
      p90TokensPerSec: percentile(rates, 0.9),
      avgLoadDurationMs: loads.length === 0 ? null : average(loads)
    })
  }
  return summaries
}
