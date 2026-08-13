import type { AiModel } from '@shared/ipc'

// What a context window COSTS IN RAM, and how large a one this machine can
// afford (D15.2). Arithmetic over the `attention` block /api/show returns, plus
// two measured constants; pure and no Electron, with free RAM passed in so it
// stays testable. Bytes here, tokens in budget.ts; only a ceiling crosses.

/**
 * Runner overhead on top of the KV cache itself. Measured, not derived: 38,0 KB
 * per token against the 36,0 the formula predicts, on qwen2.5-coder:3b (D15.8).
 */
const OVERHEAD = 1.06

/**
 * Weights aside, a loaded model costs this much before a single token of
 * context. Measured, not predicted (`ollama ps`: 2,129 GB base). It is LARGER
 * than a small model's whole cache at 4k, so ignoring it understates every
 * model by a third of a gigabyte, always in the dangerous direction (D15.2).
 */
const FIXED_OVERHEAD_BYTES = 0.33 * 1024 ** 3

/**
 * Head-room so the app never reserves the last byte the machine has.
 *
 * Subtracted BEFORE the per-token division, so it is not a fixed cost: it buys a
 * 3B model a few thousand fewer tokens and costs a 7B model its whole existence.
 * That is why it is this small — see D15.10 for the two values it has been.
 */
export const RAM_MARGIN_BYTES = 512 * 1024 ** 2

/**
 * How many layers actually grow with `num_ctx`: all of them with no sliding
 * window, ONE with an active one (empirical — 1,07 measured on gemma3:4b, and
 * it closes both measurements with the same OVERHEAD). The window is compared
 * to the model's own ceiling, never to the candidate `numCtx` being computed,
 * which would make this recursive on its own output (D15.8).
 */
function growingLayers(model: AiModel): number {
  const attention = model.attention
  if (attention === null) return 0

  const window = attention.slidingWindow
  const ceiling = model.contextLength
  const windowIsActive = window !== null && ceiling !== null && window < ceiling
  return windowIsActive ? 1 : attention.blockCount
}

/**
 * Bytes of KV cache each token of context costs this model.
 *
 * `2 × layers × kvHeads × headDim × 2` — two for K and V, two for f16 — times
 * the measured overhead. Returns null when the model reports no attention
 * block, which means "cannot be costed", never "is free".
 */
export function kvBytesPerToken(model: AiModel): number | null {
  const attention = model.attention
  if (attention === null) return null

  const layers = growingLayers(model)
  return 2 * layers * attention.headCountKv * attention.headDim * 2 * OVERHEAD
}

/** Total resident bytes this model would occupy at the given context window. */
export function residentBytes(model: AiModel, numCtx: number): number | null {
  const perToken = kvBytesPerToken(model)
  if (perToken === null) return null
  return model.sizeBytes + FIXED_OVERHEAD_BYTES + perToken * numCtx
}

/**
 * The largest context window worth offering, in tokens: `min(trained ceiling,
 * what this machine can hold)`. Offering only the first is the honest-looking
 * mistake — phi4-mini declares 131072, which is 16 GB of cache on a 16 GB
 * machine. `freeBytes` is read at call time (this machine reports ~6–9 GB free
 * depending on what else runs), and `marginBytes` covers the working
 * environment coming back, since a reservation made while idle never shrinks and
 * would cause the very swap it prevents (D15.2, D15.10).
 */
export function contextCeiling(
  model: AiModel,
  freeBytes: number,
  marginBytes: number
): number | null {
  const trained = model.contextLength
  const perToken = kvBytesPerToken(model)
  // Nothing to bound: without a trained ceiling or without attention data there
  // is no honest number to offer, and inventing one is what this exists to stop.
  if (trained === null || perToken === null || perToken === 0) return null

  const forCache = freeBytes - marginBytes - model.sizeBytes - FIXED_OVERHEAD_BYTES
  if (forCache <= 0) return 0

  return Math.min(trained, Math.floor(forCache / perToken))
}
