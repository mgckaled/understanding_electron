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
 * Head-room so the app never reserves the last byte the machine has.
 *
 * Subtracted BEFORE the per-token division, so it is not a fixed cost: it buys a
 * 3B model a few thousand fewer tokens and costs a 7B model its whole existence.
 * That is why it is this small — see D15.10 for the two values it has been.
 */
export const RAM_MARGIN_BYTES = 512 * 1024 ** 2

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

/**
 * Characters per token for Portuguese prose, measured on this project's own
 * documents in ago/2026 (D15.4).
 *
 * Only a starting point, and knowingly a rough one: the same measurement found
 * 3,8 for varied prose and 4,3–5,1 for text that repeats itself, so estimating
 * by character is wrong by up to a third depending on what is being written. It
 * is enough for a meter and NOT enough for a gate — which is why the gate
 * carries a margin and the ratio recalibrates itself after the first turn.
 */
export const DEFAULT_CHARS_PER_TOKEN = 3.8

/**
 * The characters-per-token ratio this conversation actually exhibits.
 *
 * There is no way to tokenize before sending, so every estimate before a call
 * is a guess. But every reply comes back with `prompt_eval_count`, which is the
 * exact count of what was just read — dividing the characters that were sent by
 * it gives the real density of THIS conversation: its language, its style, its
 * attachments. The error shrinks each turn instead of accumulating.
 *
 * Falls back to the default when there is nothing to learn from, which includes
 * a provider that does not report counters at all.
 */
export function calibrateRatio(sentChars: number, promptTokens: number | undefined): number {
  if (promptTokens === undefined || promptTokens <= 0 || sentChars <= 0) {
    return DEFAULT_CHARS_PER_TOKEN
  }
  return sentChars / promptTokens
}

/** Characters to tokens, at the given density. Always rounds up. */
export function estimateTokens(chars: number, charsPerToken: number): number {
  if (charsPerToken <= 0) return 0
  return Math.ceil(chars / charsPerToken)
}

/**
 * Head-room the gate keeps because the estimate is OPTIMISTIC BY CONSTRUCTION.
 *
 * Character-based estimation can undercount by roughly a third, so a gate that
 * fired exactly at the nominal ceiling would fire after the damage. A gate that
 * only reports the overflow once it has happened is not a gate, it is a report.
 */
export const GATE_MARGIN = 0.9

/**
 * The window the app reserves when the conversation has not chosen one (D15.2).
 *
 * It replaces Ollama's own default of 4096 on this machine — a number nobody
 * chose, and one that a single 8k-token document overflows on its own, silently.
 *
 * 32768 and not the model's trained ceiling, even though the ceiling is often
 * affordable: reserving the window is cheap, FILLING it is not. gemma3:4b can
 * hold its declared 131072 in RAM, and filling it would be ~87 minutes of
 * prefill on this CPU. 32k is where the measurements were taken and is already
 * eight times what the provider would have picked.
 */
export const DEFAULT_NUM_CTX = 32768

/**
 * The smallest window worth reserving — below it there is no conversation to be
 * had. Also the step of the control the user types into, so the two agree.
 *
 * `contextCeiling` legitimately returns 0 for a model that does not fit, and
 * this is the line between that and a window (D15.10).
 */
export const MIN_NUM_CTX = 1024

/**
 * Whether this machine can hold the model at all, given its ceiling. A `null`
 * ceiling reads as TRUE: the model could not be costed, and refusing to run it
 * would be the app inventing a limit it has no basis for.
 */
export function fitsInMemory(ceiling: number | null): boolean {
  return ceiling === null || ceiling >= MIN_NUM_CTX
}

/**
 * The window actually in force: what the conversation chose, else the app's
 * default, never above what this machine can hold.
 *
 * `null` ceiling means the model could not be costed, and then the app's own
 * default stands — refusing to reserve anything would silently hand the
 * decision back to the provider, which is the behaviour this replaces.
 *
 * Returns `null` when the model does not fit at all, rather than a token or two:
 * a window that small is a fiction the meter and the gate both act on (D15.10).
 */
export function effectiveNumCtx(chosen: number | undefined, ceiling: number | null): number | null {
  if (!fitsInMemory(ceiling)) return null
  const wanted = chosen ?? DEFAULT_NUM_CTX
  return ceiling === null ? wanted : Math.min(wanted, ceiling)
}

export type Budget = {
  /** Estimated tokens the next send would consume, prompt side. */
  estimated: number
  /** The window it has to fit into. */
  limit: number
  /** 0..1+, for a meter. Above 1 means it does not fit at all. */
  used: number
  /** False when the next send must be refused (D15.5). */
  fits: boolean
  /**
   * True when the new message alone overflows the window. Genuinely rare and
   * genuinely different: starting a new conversation does not help, and the
   * screen has to say so instead of offering it.
   */
  messageAloneOverflows: boolean
}

/**
 * What the next send would cost, and whether it is allowed (D15.4, D15.5).
 *
 * `limit` is the conversation's own window — the reserved `num_ctx`, or the
 * provider default when nothing was chosen. Note it is NOT the model's trained
 * ceiling: what is reserved is what exists.
 */
export function budgetFor(input: {
  historyChars: number
  draftChars: number
  limit: number
  charsPerToken: number
}): Budget {
  const { historyChars, draftChars, limit, charsPerToken } = input
  const estimated = estimateTokens(historyChars + draftChars, charsPerToken)
  const draftAlone = estimateTokens(draftChars, charsPerToken)
  const allowed = Math.floor(limit * GATE_MARGIN)

  return {
    estimated,
    limit,
    used: limit <= 0 ? 0 : estimated / limit,
    fits: estimated <= allowed,
    messageAloneOverflows: draftAlone > allowed
  }
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
