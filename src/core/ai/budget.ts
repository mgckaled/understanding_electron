import type { AiModel } from '@shared/ipc'

/*
 * What a context window COSTS, and therefore how large a one this machine can
 * afford (D15.2).
 *
 * Everything here is arithmetic over the `attention` block that /api/show
 * already returns, plus two constants that could not be derived and were
 * measured instead. Pure, no network, no Electron — the free-RAM figure arrives
 * as a parameter precisely so this stays testable across scenarios without
 * simulating an operating system.
 */

/**
 * Runner overhead on top of the KV cache itself.
 *
 * Measured 10/08/2026 on qwen2.5-coder:3b: 38,0 KB per token against the 36,0
 * the formula predicts. Before this measurement the working assumption was a
 * factor of ~0,18 — the arithmetic and the one available measurement disagreed
 * by 5,6× — and the whole point of measuring was that the disagreement decided
 * whether half the fleet could run at 32k. The arithmetic was right.
 */
const OVERHEAD = 1.06

/**
 * Weights aside, a loaded model costs this much before a single token of
 * context. Not predicted — it fell out of the data: `ollama ps` reported 2,277
 * GB at 4k and 3,316 GB at 32k, and subtracting the cache from each leaves the
 * same 2,129 GB base against 1,80 GB on disk.
 *
 * It matters because it is LARGER than the entire cache of a small model at 4k.
 * Ignoring it would understate every model by a third of a gigabyte, always in
 * the dangerous direction.
 */
const FIXED_OVERHEAD_BYTES = 0.33 * 1024 ** 3

/**
 * Head-room left for the WORKING ENVIRONMENT COMING BACK.
 *
 * Not a round number picked for comfort: it is the measured spread between this
 * machine's scenarios — ~9 GB free with only the app running, ~6 GB with the
 * editor, browser and agent open. `num_ctx` reserves its cache when the model
 * loads and the reservation never shrinks, so a ceiling computed from a
 * snapshot of an idle machine makes the app cause the swap it exists to
 * prevent.
 *
 * The asymmetry is what fixes the value: underestimating costs context the user
 * could have had; overestimating costs the machine freezing in the middle of an
 * answer. Those are not errors of the same size.
 */
export const RAM_MARGIN_BYTES = 3 * 1024 ** 3

/**
 * How many layers actually grow with `num_ctx`.
 *
 * With no sliding window, all of them. With an active one, ONE — which is
 * empirical and worth flagging as such: the 4,3 KB/token measured on gemma3:4b
 * divided by the 4 KB one layer costs there gives 1,07, not the ~6 global
 * layers Gemma 3's documented 5:1 ratio would imply. What lends it credit is
 * that it closes BOTH measurements with the same OVERHEAD.
 *
 * The comparison is against the model's own ceiling and not against the
 * candidate `numCtx`, and that is not stylistic: `numCtx` is the value being
 * computed, so testing against it would make this recursive on its own output.
 * Every model in the fleet gives the same verdict either way — real windows are
 * 512 and 1024, far below any offered window — and the one inert window
 * (phi4-mini's 262144) is inert precisely because it exceeds its own ceiling.
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
 * The largest context window worth offering for this model, in tokens.
 *
 * `min(what the model was trained for, what this machine can hold)`. Offering
 * only the first is the honest-looking mistake: phi4-mini truthfully declares
 * 131072, and honouring it means reserving 16 GB of cache on a 16 GB machine.
 * The datum is correct and the conclusion drawn from it is not.
 *
 * `freeBytes` is read at call time rather than baked in, because there is no
 * single figure: this machine reports ~9 GB with only the app running, ~7,5 GB
 * with only the editor, ~6 GB in the working environment. A constant would be
 * wrong in two scenarios out of three.
 *
 * `marginBytes` covers the WORKING ENVIRONMENT COMING BACK. `num_ctx` reserves
 * its cache at load time and the reservation never shrinks, so a ceiling
 * computed from a snapshot of an idle machine makes the app cause the swap it
 * was supposed to prevent. The asymmetry sets the value: underestimating costs
 * context the user could have had, overestimating costs the machine freezing
 * mid-answer.
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
