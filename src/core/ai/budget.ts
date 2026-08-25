// How many TOKENS the next send costs, whether it is allowed (D15.4, D15.5),
// and which window it must fit once the conversation locks one (D15.13). The
// RAM side is in memory.ts; only a ceiling in tokens crosses, so nothing here
// takes an AiModel.

/**
 * Characters per token for Portuguese prose, measured on this project's docs
 * (D15.4). A rough starting point — the same measurement found 3,8 for varied
 * prose and up to 5,1 for repetitive text — so the gate carries a margin and
 * the ratio recalibrates after the first turn.
 */
export const DEFAULT_CHARS_PER_TOKEN = 3.8

/**
 * Fixed token cost of one image, measured on gemma3:4b — the only model with
 * `vision` in the fleet today (D17.12). Not proportional to anything the app
 * sends, so it adds to the estimate as a flat term instead of folding into
 * the char ratio.
 */
export const IMAGE_TOKEN_ESTIMATE = 270

/**
 * The characters-per-token ratio this conversation actually exhibits.
 *
 * No tokenizer runs before sending, so each pre-call estimate is a guess; every
 * reply returns `prompt_eval_count`, the exact count read, and dividing sent
 * chars by it gives this conversation's real density. Falls back to the default
 * when there is nothing to learn from (including a provider with no counters).
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
 * Replaces Ollama's 4096 on this machine — a number nobody chose that one
 * 8k-token document overflows. 32768 and not the trained ceiling because
 * reserving a window is cheap and FILLING it is not: gemma3:4b's declared
 * 131072 would be ~87 minutes of prefill on this CPU.
 */
export const DEFAULT_NUM_CTX = 32768

/**
 * The smallest window worth reserving, and the step of the control the user
 * types into. `contextCeiling` legitimately returns 0 for a model that does not
 * fit; this is the line between that and a real window (D15.10).
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
 * The window in force: what the conversation chose, else the app's default,
 * never above what the machine can hold (a `null` ceiling means uncosted, so
 * the default stands). Returns `null` when the model does not fit at all, not a
 * token or two — a window that small is a fiction the meter and gate act on (D15.10).
 */
export function effectiveNumCtx(chosen: number | undefined, ceiling: number | null): number | null {
  if (!fitsInMemory(ceiling)) return null
  const wanted = chosen ?? DEFAULT_NUM_CTX
  return ceiling === null ? wanted : Math.min(wanted, ceiling)
}

/**
 * The window in force for a conversation, and whether it can be sent into.
 *
 * The pair `(model, num_ctx)` closes on the first send (D15.13): before it the
 * window is derived from what fits right now, after it the recorded number
 * stands as written and is never re-derived.
 */
export type ConversationWindow =
  /** Nothing sent yet — the pair is still free to change. */
  | { status: 'open'; numCtx: number }
  /** Recorded at the first send, and this machine can still hold it. */
  | { status: 'locked'; numCtx: number }
  /** The model does not fit in the memory free right now. */
  | { status: 'too-large' }
  /** A locked window this machine can no longer allocate. */
  | { status: 'unaffordable'; numCtx: number }

/**
 * Which of the four the conversation is in.
 *
 * `unaffordable` is the lock's asymmetric failure mode: the reservation is
 * remade on every load and free RAM varies by 3 GB here, so a window locked
 * while idle may not allocate later — refusing is the point, since shrinking in
 * silence is what the lock removes.
 */
export function conversationWindow(input: {
  locked: boolean
  /** What the conversation recorded for itself; absent before its first send. */
  reserved: number | undefined
  ceiling: number | null
  /**
   * Whether this window is a real local RAM reservation (Ollama) that can
   * become unaffordable later, or a client-side budget bound only, never sent
   * to the provider (cloud, N-1-C) — `num_ctx` reaches no cloud adapter's
   * request body. The lock protects against the first; the second has
   * nothing to protect against, so it always re-derives instead of freezing
   * — including a conversation already locked at a stale value from before
   * this parameter existed.
   */
  costed: boolean
}): ConversationWindow {
  const { locked, reserved, ceiling, costed } = input

  if (costed && locked && reserved !== undefined) {
    return ceiling === null || reserved <= ceiling
      ? { status: 'locked', numCtx: reserved }
      : { status: 'unaffordable', numCtx: reserved }
  }

  // Everything else derives — including a conversation from before the lock
  // existed, which has turns but no recorded window until its next send, and
  // (for cloud) any conversation at all, locked or not.
  const derived = effectiveNumCtx(reserved, ceiling)
  if (derived === null) return { status: 'too-large' }
  return { status: locked && costed ? 'locked' : 'open', numCtx: derived }
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
  /** Flat tokens added on top of the char-based estimate — image cost (D17.12), not proportional to chars. */
  flatTokens?: number
}): Budget {
  const { historyChars, draftChars, limit, charsPerToken, flatTokens = 0 } = input
  const estimated = estimateTokens(historyChars + draftChars, charsPerToken) + flatTokens
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
