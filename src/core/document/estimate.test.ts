import { estimateReadSeconds } from './estimate'

describe('estimateReadSeconds', () => {
  it('grows with file size', () => {
    expect(estimateReadSeconds(100_000)).toBeLessThan(estimateReadSeconds(1_000_000))
  })

  it('never reports less than 1 second', () => {
    expect(estimateReadSeconds(0)).toBe(1)
    expect(estimateReadSeconds(10)).toBe(1)
  })

  it('lands near five minutes at the ~30kB practical ceiling (docs/ESCOPO.md § o anexo custa segundos de prefill)', () => {
    // Independent cross-check, not a tuned constant: ESCOPO.md states the
    // ~8k-token/~30kB ceiling costs "mais de cinco minutos" of prefill,
    // measured against the real provider — this formula lands right there.
    const seconds = estimateReadSeconds(30_000)
    expect(seconds).toBeGreaterThan(240)
    expect(seconds).toBeLessThan(330)
  })
})
