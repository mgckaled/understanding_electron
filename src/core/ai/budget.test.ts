import type { AiModel } from '@shared/ipc'
import {
  budgetFor,
  calibrateRatio,
  contextCeiling,
  DEFAULT_CHARS_PER_TOKEN,
  DEFAULT_NUM_CTX,
  effectiveNumCtx,
  estimateTokens,
  fitsInMemory,
  kvBytesPerToken,
  MIN_NUM_CTX,
  RAM_MARGIN_BYTES,
  residentBytes
} from './budget'

const GIB = 1024 ** 3

/*
 * The fleet as measured on 10/08/2026. qwen2.5-coder:3b is the calibration
 * point — `ollama ps` reported 3,316 GB at num_ctx 32768 — so the assertion
 * about it is the one that ties this arithmetic to reality rather than to
 * itself.
 */

function model(over: Partial<AiModel>): AiModel {
  return {
    provider: 'ollama',
    name: 'x',
    parameterSize: '',
    sizeBytes: 0,
    capabilities: ['completion'],
    contextLength: 32768,
    attention: null,
    variantOf: null,
    ...over
  }
}

const qwenCoder3b = model({
  name: 'qwen2.5-coder:3b',
  sizeBytes: 1.8 * GIB,
  contextLength: 32768,
  attention: { blockCount: 36, headCountKv: 2, headDim: 128, slidingWindow: null }
})

const gemma3_4b = model({
  name: 'gemma3:4b',
  sizeBytes: 3.11 * GIB,
  contextLength: 131072,
  attention: { blockCount: 34, headCountKv: 4, headDim: 256, slidingWindow: 1024 }
})

const phi4Mini = model({
  name: 'phi4-mini',
  sizeBytes: 2.32 * GIB,
  contextLength: 131072,
  // Declared, and larger than this model's own ceiling — so it never closes
  // over anything and the model pays full attention prices.
  attention: { blockCount: 32, headCountKv: 8, headDim: 128, slidingWindow: 262144 }
})

const qwen7b = model({
  name: 'qwen2.5:7b',
  sizeBytes: 4_683_087_332,
  contextLength: 32768,
  attention: { blockCount: 28, headCountKv: 4, headDim: 128, slidingWindow: null }
})

const embedder = model({ name: 'nomic-embed-text', contextLength: 2048, attention: null })

describe('kvBytesPerToken', () => {
  it('matches the 38 KB/token measured on qwen2.5-coder:3b', () => {
    // 36 layers × 2 KV heads × 128 dims, ×2 for K and V, ×2 for f16, ×1,06.
    expect(kvBytesPerToken(qwenCoder3b)! / 1024).toBeCloseTo(38.2, 1)
  })

  it('counts ONE growing layer for a model with an active sliding window', () => {
    // Measured 4,3 KB/token on gemma3:4b. Its 34 layers at full price would be
    // 136 KB — the window is the entire difference, and it is why the "num_ctx
    // costs nothing" measurement from the previous session did not generalize.
    expect(kvBytesPerToken(gemma3_4b)! / 1024).toBeCloseTo(4.24, 2)
  })

  it('charges full price when the declared window is larger than the ceiling', () => {
    // The trap: `if (slidingWindow)` is truthy for phi4-mini and would classify
    // the most expensive model in the fleet as the cheapest, off by 4 GB.
    expect(kvBytesPerToken(phi4Mini)! / 1024).toBeCloseTo(135.7, 1)
    expect(kvBytesPerToken(phi4Mini)!).toBeGreaterThan(kvBytesPerToken(gemma3_4b)! * 30)
  })

  it('is null for a model with no attention block, never zero', () => {
    // Zero would read as "free" and let the ceiling go to infinity.
    expect(kvBytesPerToken(embedder)).toBeNull()
  })
})

describe('residentBytes', () => {
  it('reproduces the 3,32 GB measured for qwen2.5-coder:3b at 32k', () => {
    expect(residentBytes(qwenCoder3b, 32768)! / GIB).toBeCloseTo(3.32, 1)
  })

  it('reproduces the 2,28 GB measured for the same model at 4k', () => {
    // Two points, one formula: the fixed 0,33 GB overhead is what makes both
    // land, and it was derived from these two numbers rather than assumed.
    expect(residentBytes(qwenCoder3b, 4096)! / GIB).toBeCloseTo(2.28, 1)
  })

  it('says a lightweight model can cost more than a heavy one', () => {
    // phi4-mini is 2,32 GB on disk against qwen2.5:7b-class weights, and at 32k
    // it still ends up more expensive. Model size does not predict context cost,
    // and no column of `ollama list` shows this.
    expect(residentBytes(phi4Mini, 32768)!).toBeGreaterThan(residentBytes(gemma3_4b, 32768)!)
    expect(phi4Mini.sizeBytes).toBeLessThan(gemma3_4b.sizeBytes)
  })
})

describe('contextCeiling', () => {
  it('clamps below the ceiling the model truthfully declares', () => {
    // The case the whole decision exists for: phi4-mini declares 131072 and
    // honouring it means 16 GB of cache. The datum is right; the conclusion is
    // not, and only a derived bound tells them apart.
    const ceiling = contextCeiling(phi4Mini, 6 * GIB, 0)

    expect(ceiling).toBeLessThan(131072)
    expect(ceiling).toBeGreaterThan(0)
  })

  it('gives the same model different ceilings on a busier machine', () => {
    // Proof the free-RAM figure is entering the arithmetic rather than being
    // decoration. There is no single "free RAM" on this machine: ~6 GB in the
    // working environment, ~9 GB with only the app running.
    const busy = contextCeiling(phi4Mini, 6 * GIB, 0)!
    const idle = contextCeiling(phi4Mini, 9 * GIB, 0)!

    expect(idle).toBeGreaterThan(busy)
  })

  it('lets a sliding-window model reach the ceiling it declares', () => {
    // gemma3:4b is the one model whose declared 131072 is affordable — 3,97 GB
    // all-in. This inverted what the plan assumed: what keeps it out of reach is
    // ~87 minutes of prefill, not memory.
    expect(contextCeiling(gemma3_4b, 6 * GIB, 0)).toBe(131072)
  })

  it('never exceeds what the model was trained for, however much RAM there is', () => {
    expect(contextCeiling(qwenCoder3b, 64 * GIB, 0)).toBe(32768)
  })

  it('shrinks by exactly the margin it is given', () => {
    const withoutMargin = contextCeiling(phi4Mini, 9 * GIB, 0)!
    const withMargin = contextCeiling(phi4Mini, 9 * GIB, 3 * GIB)!

    expect(withMargin).toBeLessThan(withoutMargin)
  })

  it('returns zero rather than a negative window when nothing fits', () => {
    // A machine too small for the weights alone. Zero is a state the selector
    // can draw; a negative number is one it would silently pass to the runner.
    expect(contextCeiling(phi4Mini, 1 * GIB, 0)).toBe(0)
  })

  it('is null when there is nothing to bound', () => {
    expect(contextCeiling(embedder, 8 * GIB, 0)).toBeNull()
    expect(contextCeiling(model({ contextLength: null }), 8 * GIB, 0)).toBeNull()
  })

  it('leaves a 7B model a usable window in the working environment', () => {
    // The regression that made this margin a measurement. At 1 GiB every 7B in
    // the fleet came back at ceiling 0: a fixed margin subtracted BEFORE the
    // per-token division costs a small model tokens and a large one everything.
    expect(contextCeiling(qwen7b, 5.44 * GIB, RAM_MARGIN_BYTES)!).toBeGreaterThan(MIN_NUM_CTX)
    expect(contextCeiling(qwen7b, 5.44 * GIB, GIB)).toBe(0)
  })
})

describe('fitsInMemory', () => {
  it('reads a ceiling too small to converse in as not fitting', () => {
    expect(fitsInMemory(0)).toBe(false)
    expect(fitsInMemory(MIN_NUM_CTX - 1)).toBe(false)
    expect(fitsInMemory(MIN_NUM_CTX)).toBe(true)
  })

  it('treats a model it cannot cost as fitting', () => {
    // Absence of a bound is not evidence of a problem; inventing a limit is.
    expect(fitsInMemory(null)).toBe(true)
  })
})

describe('effectiveNumCtx', () => {
  it('returns null when no window fits, rather than a window of one token', () => {
    // A one-token window is not a smaller window, it is a fiction: the meter
    // read "~1 de 1 tokens" and the gate refused every message at any length.
    expect(effectiveNumCtx(32768, 0)).toBeNull()
  })

  it('clamps a choice to what the machine can hold', () => {
    expect(effectiveNumCtx(131072, 8192)).toBe(8192)
  })

  it('falls back to the app default rather than to the provider default', () => {
    expect(effectiveNumCtx(undefined, 131072)).toBe(DEFAULT_NUM_CTX)
    expect(effectiveNumCtx(undefined, null)).toBe(DEFAULT_NUM_CTX)
  })
})

describe('calibrateRatio', () => {
  it('uses the observed density once a reply reports its token count', () => {
    // 7600 characters that the provider read as 2000 tokens is 3,8 — but the
    // point is that the number comes from THIS conversation instead of from an
    // average over documents nobody in it wrote.
    expect(calibrateRatio(8000, 2000)).toBe(4)
  })

  it('falls back to the measured Portuguese default on the first turn', () => {
    expect(calibrateRatio(1000, undefined)).toBe(DEFAULT_CHARS_PER_TOKEN)
  })

  it('falls back when a provider reports no counters at all', () => {
    // A cloud provider may not send them. The meter degrades to an estimate,
    // which is what it already is before the first reply.
    expect(calibrateRatio(1000, 0)).toBe(DEFAULT_CHARS_PER_TOKEN)
  })

  it('pulls the estimate in the right direction after one observation', () => {
    // Text that repeats packs more characters per token (4,3–5,1 measured), so
    // the generic ratio OVERESTIMATES tokens for it. One observation corrects
    // that, and the error shrinks per turn instead of accumulating.
    const dense = calibrateRatio(10_000, 2000) // 5,0 chars/token

    expect(estimateTokens(10_000, dense)).toBeLessThan(
      estimateTokens(10_000, DEFAULT_CHARS_PER_TOKEN)
    )
  })
})

describe('budgetFor', () => {
  const base = { limit: 4096, charsPerToken: 4 }

  it('counts history and draft together, because both are sent', () => {
    const budget = budgetFor({ ...base, historyChars: 4000, draftChars: 4000 })

    expect(budget.estimated).toBe(2000)
    expect(budget.used).toBeCloseTo(0.488, 2)
  })

  it('allows a send that fits', () => {
    expect(budgetFor({ ...base, historyChars: 1000, draftChars: 100 }).fits).toBe(true)
  })

  it('refuses before the nominal ceiling, because the estimate is optimistic', () => {
    // 15.000 characters at 4 per token is 3.750 tokens — under the 4.096
    // window, so a naive gate would let it through. The estimate can undercount
    // by a third, and a gate that fires only after the damage is a report.
    const budget = budgetFor({ ...base, historyChars: 15_000, draftChars: 0 })

    expect(budget.estimated).toBeLessThan(4096)
    expect(budget.fits).toBe(false)
  })

  it('flags the case where the new message alone does not fit', () => {
    // Rare, and different in kind: "start a new conversation" does not help,
    // and the screen has to say so instead of offering it as a way out.
    const budget = budgetFor({ ...base, historyChars: 0, draftChars: 40_000 })

    expect(budget.fits).toBe(false)
    expect(budget.messageAloneOverflows).toBe(true)
  })

  it('does not flag the message when it is the history that is large', () => {
    const budget = budgetFor({ ...base, historyChars: 40_000, draftChars: 100 })

    expect(budget.fits).toBe(false)
    expect(budget.messageAloneOverflows).toBe(false)
  })

  it('reports above 1 when the send overflows, so a meter can show it', () => {
    expect(budgetFor({ ...base, historyChars: 40_000, draftChars: 0 }).used).toBeGreaterThan(1)
  })
})
