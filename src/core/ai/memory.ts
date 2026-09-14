import type { AiModel, AiModelAttention } from '@shared/ipc'
import { isCloudService } from './messages'

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
 * The same overhead for a hybrid (Mamba/Gated DeltaNet plus attention) family,
 * where the measured residual is 1,13–1,18 and points at UNDERSTATING the cost —
 * the dangerous direction. Measured on both qwen3.5 models (DN3A.8).
 */
const HYBRID_OVERHEAD = 1.2

/**
 * Query heads per KV head, for a hybrid that publishes no head_count_kv. Not a
 * family rule: the published config gives 16/4 and 8/2 on the dense line but
 * 32/2 on the 397B MoE, so this is the dense line's measured ratio, and a third
 * hybrid with another ratio reopens it (DN3A.7). Erring high costs window, never
 * safety.
 */
const HYBRID_QUERY_PER_KV_HEAD = 4

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
  if (windowIsActive) return 1

  // A hybrid grows only on its full-attention layers — one in N, the rest hold a
  // fixed-size recurrent state. Rounding up keeps the estimate on the safe side
  // of a block count the interval does not divide (DN3A.7).
  const interval = attention.fullAttentionInterval
  if (interval !== null && interval > 0) return Math.ceil(attention.blockCount / interval)
  return attention.blockCount
}

/**
 * KV heads: published when the model reports them, derived for a hybrid that
 * does not. Null when neither route is available, which `readAttention` already
 * refuses to build — kept here so the arithmetic never silently reads a zero.
 */
function kvHeads(attention: AiModelAttention): number | null {
  if (attention.headCountKv !== null) return attention.headCountKv
  if (attention.headCount === null || attention.fullAttentionInterval === null) return null
  return attention.headCount / HYBRID_QUERY_PER_KV_HEAD
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

  const heads = kvHeads(attention)
  if (heads === null) return null

  const layers = growingLayers(model)
  const overhead = attention.fullAttentionInterval === null ? OVERHEAD : HYBRID_OVERHEAD
  return 2 * layers * heads * attention.headDim * 2 * overhead
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

/**
 * Whether this model's window is a real reservation of local RAM, or a
 * client-side budget only (cloud, DN1C.2) — what decides whether
 * `conversationWindow` ever freezes it.
 */
export function costsLocalRam(model: AiModel): boolean {
  return !isCloudService(model.provider)
}

/**
 * The largest window the selector should OFFER, decided by service.
 *
 * Never by `attention === null`, which carried two incompatible meanings until
 * DN3A.5 — "cloud, so RAM is free" and "could not read this local model's
 * attention" — and under the second one the two hybrid qwen3.5 were offered
 * their trained 262144 on a machine that holds a fifth of it.
 *
 * @param freeBytes - Undefined while the reading is still in flight; irrelevant
 *   for a cloud model, whose ceiling does not depend on this machine.
 */
export function offeredCeiling(
  model: AiModel,
  freeBytes: number | undefined,
  marginBytes: number
): number | null {
  if (!costsLocalRam(model)) return model.contextLength
  if (freeBytes === undefined) return null
  return contextCeiling(model, freeBytes, marginBytes)
}
