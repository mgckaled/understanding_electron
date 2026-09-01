import { summarizeByModel, type PerformanceRow } from './performance'

function row(overrides: Partial<PerformanceRow>): PerformanceRow {
  return {
    id: 1,
    service: 'ollama',
    model: 'gemma3:4b',
    evalTokens: 100,
    ttftMs: 200,
    decodeMs: 2000,
    createdAt: 0,
    ...overrides
  }
}

describe('summarizeByModel', () => {
  it('computes n, avg, median and p90 tokens/s per (service, model) bucket', () => {
    const rows = [
      row({ id: 1, evalTokens: 100, decodeMs: 2000 }), // 50 tok/s
      row({ id: 2, evalTokens: 100, decodeMs: 1000 }), // 100 tok/s
      row({ id: 3, evalTokens: 100, decodeMs: 500 }) //  200 tok/s
    ]

    const [summary] = summarizeByModel(rows)
    expect(summary).toMatchObject({
      service: 'ollama',
      model: 'gemma3:4b',
      n: 3,
      avgTokensPerSec: (50 + 100 + 200) / 3,
      medianTokensPerSec: 100,
      p90TokensPerSec: 200
    })
  })

  it('never mixes buckets from different (service, model) pairs', () => {
    const rows = [
      row({ service: 'ollama', model: 'gemma3:4b' }),
      row({ service: 'glm', model: 'glm-4.5' })
    ]

    const summaries = summarizeByModel(rows)
    expect(summaries).toHaveLength(2)
    expect(summaries.map((s) => s.service).sort()).toEqual(['glm', 'ollama'])
  })

  it('reports null maxLoadDurationMs when no row in the bucket has it — never zero', () => {
    const [summary] = summarizeByModel([row({ loadDurationMs: undefined })])
    expect(summary.maxLoadDurationMs).toBeNull()
  })

  it('reports the MAX load, not the average — a cold and a warm load in the same bucket must not blend', () => {
    // Measured live against qwen2.5-coder:3b (01/09/2026): cold ~13.5s,
    // the very next call on the same model ~6ms once resident. Averaging
    // the two would report a number that describes neither (DO7.2 revisited).
    const rows = [row({ loadDurationMs: 13_531 }), row({ loadDurationMs: 6 })]
    const [summary] = summarizeByModel(rows)
    expect(summary.maxLoadDurationMs).toBe(13_531)
  })

  it('ignores rows with no loadDurationMs when computing the max (cloud rows stay absent)', () => {
    const rows = [row({ loadDurationMs: undefined }), row({ loadDurationMs: 48_000 })]
    const [summary] = summarizeByModel(rows)
    expect(summary.maxLoadDurationMs).toBe(48_000)
  })

  it('drops a row with a zero decode window instead of producing Infinity or NaN', () => {
    const rows = [
      row({ id: 1, decodeMs: 0, evalTokens: 5 }),
      row({ id: 2, decodeMs: 1000, evalTokens: 100 })
    ]
    const [summary] = summarizeByModel(rows)
    expect(summary.n).toBe(1)
    expect(Number.isFinite(summary.avgTokensPerSec)).toBe(true)
  })

  it('omits a bucket entirely when every row in it has a zero decode window', () => {
    const summaries = summarizeByModel([row({ decodeMs: 0 })])
    expect(summaries).toHaveLength(0)
  })

  it('drops a reply too short to produce a stable rate (DO7.8, measured live)', () => {
    // Measured live against qwen2.5-coder:3b: a 2-token reply's tokens/s
    // came out +12.6% high against Ollama's own eval_count/eval_duration; a
    // 266-token reply matched within noise. The threshold, not a correction
    // factor, is what the live measurement decided.
    const rows = [
      row({ id: 1, evalTokens: 2, decodeMs: 75 }),
      row({ id: 2, evalTokens: 100, decodeMs: 1000 })
    ]
    const [summary] = summarizeByModel(rows)
    expect(summary.n).toBe(1)
    expect(summary.avgTokensPerSec).toBe(100)
  })
})
