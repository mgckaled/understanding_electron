import type { AiService, PerformanceSummary } from '@shared/ipc'

/** What `measureChatTiming` hands to whoever persists it (O-7, § 9.2). */
export type PerformanceEvent = {
  service: AiService
  model: string
  promptTokens?: number
  evalTokens: number
  ttftMs: number
  decodeMs: number
  loadDurationMs?: number
  promptEvalDurationMs?: number
  nativeEvalDurationMs?: number
}

export type PerformanceRow = PerformanceEvent & { id: number; createdAt: number }

// Below this, evalTokens/(decodeMs/1000) is measurably biased: a 2-token
// reply measured +12.6% high against Ollama's own eval_count/eval_duration,
// because the first token's generation time is counted in ttftMs, not
// decodeMs (t1 marks the first CHUNK, not the start of decoding). A 266-token
// reply measured ~0% bias — the same denominator error is negligible once
// amortized. Subtracting one token from the numerator was tried and made the
// 2-token case worse (-43%): at this sample size the window itself is too
// short for any correction to be stable. Dropping the sample, not adjusting
// it, is the honest fix (O-7, DO7.8 — measured live, 01/09/2026).
const MIN_EVAL_TOKENS_FOR_RATE = 5

// null, never Infinity/NaN: a decode window of ~0ms or a too-short reply is a
// degenerate sample, and a fabricated (or unstable) rate would drag the
// bucket's average further than dropping the sample does.
function outputTokensPerSec(row: PerformanceRow): number | null {
  if (row.decodeMs <= 0 || row.evalTokens < MIN_EVAL_TOKENS_FOR_RATE) return null
  return row.evalTokens / (row.decodeMs / 1000)
}

// Unlike decode, prefill is never derived from our own onChunk marks — both
// promptTokens and promptEvalDurationMs are the provider's own exact count
// and duration for the SAME call, so there is no first-chunk bias to guard
// against here (O-7, DO7.9). Ollama-only: no cloud adapter reports a
// prefill-only duration, only the combined ttftMs.
function inputTokensPerSec(row: PerformanceRow): number | null {
  if (row.promptTokens === undefined || row.promptEvalDurationMs === undefined) return null
  if (row.promptEvalDurationMs <= 0) return null
  return row.promptTokens / (row.promptEvalDurationMs / 1000)
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.floor(p * sorted.length))
  return sorted[index]
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function max(values: number[]): number {
  return Math.max(...values)
}

function avgOf(values: (number | null | undefined)[]): number | null {
  const defined = values.filter((value): value is number => value !== null && value !== undefined)
  return defined.length === 0 ? null : average(defined)
}

/**
 * Groups raw rows by `(service, model)` and computes the three-way
 * decomposition promised in `reference/observatory/README.md` § 9.2 — network
 * + prefill (`ttftMs`), decode, and tokens/s, split into input (prefill) and
 * output (decode) — per bucket (O-7, DO7.5/DO7.9). The summary is derived
 * here, never a second table kept in sync with `performance_events`.
 *
 * @returns One entry per bucket that has at least one measurable output
 *   rate; a bucket where every row had a zero decode window or too few
 *   tokens (DO7.8) is omitted rather than reported with a biased number.
 */
export function summarizeByModel(rows: PerformanceRow[]): PerformanceSummary[] {
  const buckets = new Map<string, PerformanceRow[]>()
  for (const row of rows) {
    const key = `${row.service}:${row.model}`
    buckets.set(key, [...(buckets.get(key) ?? []), row])
  }

  const summaries: PerformanceSummary[] = []
  for (const bucket of buckets.values()) {
    const outputRates = bucket
      .map(outputTokensPerSec)
      .filter((rate): rate is number => rate !== null)
      .sort((a, b) => a - b)
    if (outputRates.length === 0) continue

    // MAX, not average (DO7.2 revisited): Ollama reports load_duration on
    // every call, near-zero once the model is resident — averaging one cold
    // load (measured ~13.5s) against warm ones (~6ms) would report a number
    // that describes neither. Max is the cost the user actually felt.
    const loads = bucket
      .map((row) => row.loadDurationMs)
      .filter((ms): ms is number => ms !== undefined)

    summaries.push({
      service: bucket[0].service,
      model: bucket[0].model,
      n: outputRates.length,
      avgTtftMs: average(bucket.map((row) => row.ttftMs)),
      avgDecodeMs: average(bucket.map((row) => row.decodeMs)),
      avgInputTokensPerSec: avgOf(bucket.map(inputTokensPerSec)),
      avgOutputTokensPerSec: average(outputRates),
      medianOutputTokensPerSec: percentile(outputRates, 0.5),
      p90OutputTokensPerSec: percentile(outputRates, 0.9),
      maxLoadDurationMs: loads.length === 0 ? null : max(loads)
    })
  }
  return summaries
}
