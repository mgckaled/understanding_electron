import type { AiModel } from '@shared/ipc'
import {
  contextCeiling,
  costsLocalRam,
  kvBytesPerToken,
  offeredCeiling,
  RAM_MARGIN_BYTES,
  residentBytes
} from './memory'
import { MIN_NUM_CTX } from './budget'

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
  attention: {
    blockCount: 36,
    headCountKv: 2,
    headCount: null,
    fullAttentionInterval: null,
    headDim: 128,
    slidingWindow: null
  }
})

const gemma3_4b = model({
  name: 'gemma3:4b',
  sizeBytes: 3.11 * GIB,
  contextLength: 131072,
  attention: {
    blockCount: 34,
    headCountKv: 4,
    headCount: null,
    fullAttentionInterval: null,
    headDim: 256,
    slidingWindow: 1024
  }
})

const phi4Mini = model({
  name: 'phi4-mini',
  sizeBytes: 2.32 * GIB,
  contextLength: 131072,
  // Declared, and larger than this model's own ceiling — so it never closes
  // over anything and the model pays full attention prices.
  attention: {
    blockCount: 32,
    headCountKv: 8,
    headCount: null,
    fullAttentionInterval: null,
    headDim: 128,
    slidingWindow: 262144
  }
})

const qwen7b = model({
  name: 'qwen2.5:7b',
  sizeBytes: 4_683_087_332,
  contextLength: 32768,
  attention: {
    blockCount: 28,
    headCountKv: 4,
    headCount: null,
    fullAttentionInterval: null,
    headDim: 128,
    slidingWindow: null
  }
})

const embedder = model({ name: 'nomic-embed-text', contextLength: 2048, attention: null })

/*
 * The hybrid pair, as /api/show reports it on 13/09/2026: head_count_kv comes
 * back literal null, key_length is published, and the ssm.* block plus
 * full_attention_interval say only one layer in four grows (DN3A.7). The
 * per-token cost was measured directly — loading each at num_ctx 2048 and
 * 16384 and reading the resident size from /api/ps — so the assertions below
 * are anchored to a measurement instead of to the formula restating itself.
 */
const QWEN35_4B_MEASURED_BYTES_PER_TOKEN = 36_985
const QWEN35_2B_MEASURED_BYTES_PER_TOKEN = 14_500

const qwen35_4b = model({
  name: 'qwen3.5:4b',
  sizeBytes: 3.16 * GIB,
  contextLength: 262144,
  attention: {
    blockCount: 32,
    headCountKv: null,
    headCount: 16,
    fullAttentionInterval: 4,
    headDim: 256,
    slidingWindow: null
  }
})

const qwen35_2b = model({
  name: 'qwen3.5:2b',
  sizeBytes: 2.55 * GIB,
  contextLength: 262144,
  attention: {
    blockCount: 24,
    headCountKv: null,
    headCount: 8,
    fullAttentionInterval: 4,
    headDim: 256,
    slidingWindow: null
  }
})

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

  it('costs the hybrid pair at or just above what /api/ps measured (DN3A.7, DN3A.8)', () => {
    // Above, never below: the residual measured for this family is 1,13-1,18
    // against a formula overhead of 1,2, and the direction that understates is
    // the one that hands out a window the machine cannot hold.
    const four = kvBytesPerToken(qwen35_4b)!
    const two = kvBytesPerToken(qwen35_2b)!

    expect(four).toBeGreaterThanOrEqual(QWEN35_4B_MEASURED_BYTES_PER_TOKEN)
    expect(four).toBeLessThan(QWEN35_4B_MEASURED_BYTES_PER_TOKEN * 1.15)
    expect(two).toBeGreaterThanOrEqual(QWEN35_2B_MEASURED_BYTES_PER_TOKEN)
    expect(two).toBeLessThan(QWEN35_2B_MEASURED_BYTES_PER_TOKEN * 1.15)
  })

  it('counts only the full-attention layers of a hybrid, not every block', () => {
    // 8 of 32, and 6 of 24. Counting all of them is what predicted 9,4x the
    // measured cost, crushing the ceiling to about a ninth of the real one.
    const asPureAttention = model({
      ...qwen35_4b,
      attention: { ...qwen35_4b.attention!, fullAttentionInterval: null, headCountKv: 4 }
    })

    expect(kvBytesPerToken(qwen35_4b)!).toBeLessThan(kvBytesPerToken(asPureAttention)!)
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

describe('offeredCeiling and costsLocalRam', () => {
  const cloud = model({
    provider: 'gemini',
    name: 'gemini-3.7-flash',
    sizeBytes: 0,
    contextLength: 1_048_576,
    attention: null
  })

  it('offers a local hybrid what the machine holds, not its trained ceiling', () => {
    // The defect this replaced: `attention === null` was read as "cloud", and
    // these two are local — they were offered all 262144 on a machine that
    // holds a fraction of it, and `não cabe` could never appear.
    const ceiling = offeredCeiling(qwen35_4b, 6 * GIB, RAM_MARGIN_BYTES)!

    expect(ceiling).toBeLessThan(qwen35_4b.contextLength!)
    expect(ceiling).toBeGreaterThan(MIN_NUM_CTX)
    expect(ceiling).toBe(contextCeiling(qwen35_4b, 6 * GIB, RAM_MARGIN_BYTES))
  })

  it('offers a cloud model its trained ceiling, free RAM read or not', () => {
    expect(offeredCeiling(cloud, 6 * GIB, RAM_MARGIN_BYTES)).toBe(1_048_576)
    expect(offeredCeiling(cloud, undefined, RAM_MARGIN_BYTES)).toBe(1_048_576)
  })

  it('offers nothing for a LOCAL model whose attention could not be read', () => {
    // granite4-shaped: conversational, hybrid, and publishing no interval to
    // derive from. The old branch read `attention === null` as "cloud" and
    // handed it the trained ceiling — a number with no basis on this machine.
    const unreadable = model({ name: 'granite4:3b', contextLength: 131072, attention: null })

    expect(offeredCeiling(unreadable, 6 * GIB, RAM_MARGIN_BYTES)).toBeNull()
  })

  it('waits for the memory reading before bounding a local model', () => {
    expect(offeredCeiling(qwenCoder3b, undefined, RAM_MARGIN_BYTES)).toBeNull()
  })

  it('decides costed by service, so a local model with unreadable attention still counts', () => {
    expect(costsLocalRam(qwen35_4b)).toBe(true)
    expect(costsLocalRam(model({ name: 'granite4:3b', attention: null }))).toBe(true)
    expect(costsLocalRam(cloud)).toBe(false)
  })
})
