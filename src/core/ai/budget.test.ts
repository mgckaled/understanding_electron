import {
  budgetFor,
  calibrateRatio,
  conversationWindow,
  DEFAULT_CHARS_PER_TOKEN,
  DEFAULT_NUM_CTX,
  effectiveNumCtx,
  estimateTokens,
  fitsInMemory,
  IMAGE_TOKEN_ESTIMATE,
  MIN_NUM_CTX
} from './budget'

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

  it('blends toward a new sample instead of replacing the previous ratio outright', () => {
    // First turn: 2 chars/token, no previous — a pure sample, same as today.
    // Second turn: 8 chars/token observed, blended 60/40 against the first —
    // 2 * 0.6 + 8 * 0.4 = 4.4, not 8 (a straight overwrite would report 8,
    // and a single dense/sparse turn would swing the meter every time).
    const first = calibrateRatio(80, 40)
    expect(first).toBe(2)

    const second = calibrateRatio(80, 10, first)
    expect(second).toBe(4.4)
  })

  it('ignores a turn with no counters when blending, keeping the previous ratio', () => {
    expect(calibrateRatio(1000, undefined, 4)).toBe(4)
    expect(calibrateRatio(1000, 0, 4)).toBe(4)
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

  it('adds flatTokens on top of the char-based estimate, unproportional to chars (D17.12)', () => {
    const withoutImage = budgetFor({ ...base, historyChars: 4000, draftChars: 0 })
    const withImage = budgetFor({
      ...base,
      historyChars: 4000,
      draftChars: 0,
      flatTokens: IMAGE_TOKEN_ESTIMATE
    })

    expect(withImage.estimated).toBe(withoutImage.estimated + IMAGE_TOKEN_ESTIMATE)
  })

  it('defaults flatTokens to zero, so a send with no image is unaffected', () => {
    expect(budgetFor({ ...base, historyChars: 4000, draftChars: 0 })).toEqual(
      budgetFor({ ...base, historyChars: 4000, draftChars: 0, flatTokens: 0 })
    )
  })

  it('can push a send over the gate by itself, once enough images pile up', () => {
    // 4096 window, ~90% margin: a history that fits comfortably in chars can
    // still be refused once several images add their flat cost on top.
    const budget = budgetFor({
      ...base,
      historyChars: 100,
      draftChars: 0,
      flatTokens: 15 * IMAGE_TOKEN_ESTIMATE
    })

    expect(budget.fits).toBe(false)
  })

  it('reserves nothing for generation by default, unchanged from before 21-C-A', () => {
    const budget = budgetFor({ ...base, historyChars: 3000, draftChars: 0 })
    expect(budget.fits).toBe(true)
  })

  it('reserves generation headroom only when both costed and reasoningActive are true', () => {
    // 4096 window: unreserved allowed is 3686 (GATE_MARGIN), reserved allowed
    // drops to 2253 (minus 35% of 4096) — 12.000 chars at 4/token is 3000
    // tokens, which fits the first ceiling and not the second.
    const withoutReasoning = budgetFor({ ...base, historyChars: 12_000, draftChars: 0 })
    const notCosted = budgetFor({
      ...base,
      historyChars: 12_000,
      draftChars: 0,
      costed: false,
      reasoningActive: true
    })
    const reserved = budgetFor({
      ...base,
      historyChars: 12_000,
      draftChars: 0,
      costed: true,
      reasoningActive: true
    })

    expect(withoutReasoning.fits).toBe(true)
    expect(notCosted.fits).toBe(true)
    expect(reserved.fits).toBe(false)
  })

  it('never lets the reserve push allowed below zero', () => {
    const budget = budgetFor({
      historyChars: 0,
      draftChars: 0,
      limit: 10,
      charsPerToken: 4,
      costed: true,
      reasoningActive: true
    })

    expect(budget.fits).toBe(true)
    expect(budget.messageAloneOverflows).toBe(false)
  })

  it('estimates only the chars added since the anchor, not the whole history (21-C, ancoramento pós-fato)', () => {
    // 1000 known chars measured for real at 50 tokens (a dense ratio no
    // longer reflected by the current 4 chars/token) — 200 new chars on top,
    // at the CURRENT ratio. A whole-history estimate would read
    // ceil(1200/4) = 300; anchored, the known part stays exactly 50.
    const budget = budgetFor({
      ...base,
      historyChars: 1200,
      draftChars: 0,
      anchor: { tokens: 50, chars: 1000 }
    })

    expect(budget.estimated).toBe(50 + 50) // 50 known + ceil(200/4)
  })

  it('estimates the whole history when there is nothing since the anchor yet', () => {
    const budget = budgetFor({
      ...base,
      historyChars: 1000,
      draftChars: 0,
      anchor: { tokens: 50, chars: 1000 }
    })

    expect(budget.estimated).toBe(50)
  })

  it('ignores a stale anchor when historyChars has since dropped below it (removeMessage)', () => {
    // A real path, not a defensive floor: removing a message can shrink the
    // transcript below the point the anchor was measured at. The fallback is
    // the SAME estimate an anchor-less call produces — the anchor is simply
    // set aside until a fresh turn re-measures it, not clamped to a stale
    // number that would over-estimate (and could wrongly refuse a send).
    const withStaleAnchor = budgetFor({
      ...base,
      historyChars: 10,
      draftChars: 0,
      anchor: { tokens: 50, chars: 1000 }
    })
    const withoutAnchor = budgetFor({ ...base, historyChars: 10, draftChars: 0 })

    expect(withStaleAnchor).toEqual(withoutAnchor)
  })

  it('falls back to estimating the whole history when there is no anchor yet, unchanged from before', () => {
    expect(budgetFor({ ...base, historyChars: 1200, draftChars: 0 })).toEqual(
      budgetFor({ ...base, historyChars: 1200, draftChars: 0, anchor: undefined })
    )
  })
})

/*
 * The lock (D15.13). What it buys is a denominator that stops moving: before
 * the first send the window is derived from free RAM at render time, after it
 * the recorded number stands.
 */
describe('conversationWindow', () => {
  it('derives the window while the conversation is still open', () => {
    expect(
      conversationWindow({ locked: false, reserved: undefined, ceiling: 32_768, costed: true })
    ).toEqual({
      status: 'open',
      numCtx: 32_768
    })
  })

  it('clamps an open conversation to what the machine can hold', () => {
    expect(
      conversationWindow({ locked: false, reserved: 32_768, ceiling: 6006, costed: true })
    ).toEqual({
      status: 'open',
      numCtx: 6006
    })
  })

  it('keeps a locked window even when more memory freed up', () => {
    // The point of the lock, and the direction that is easy to get wrong: a
    // ceiling that grew must not silently raise a reservation the model was
    // already loaded with.
    expect(
      conversationWindow({ locked: true, reserved: 8192, ceiling: 131_072, costed: true })
    ).toEqual({
      status: 'locked',
      numCtx: 8192
    })
  })

  it('refuses instead of shrinking when the locked window no longer fits', () => {
    // The asymmetric failure mode: the reservation is remade on every load, and
    // free RAM varies by 3 GB on this machine. Shrinking in silence would undo
    // the guarantee the lock exists to give.
    expect(
      conversationWindow({ locked: true, reserved: 32_768, ceiling: 6006, costed: true })
    ).toEqual({
      status: 'unaffordable',
      numCtx: 32_768
    })
  })

  it('locks a conversation from before the lock at what it can afford now', () => {
    // Its turns predate the pair being recorded, so there is nothing written
    // down to honour — it derives one, and its next send writes it.
    expect(
      conversationWindow({ locked: true, reserved: undefined, ceiling: 6006, costed: true })
    ).toEqual({
      status: 'locked',
      numCtx: 6006
    })
  })

  it('reports too-large when the model does not fit at all', () => {
    // `contextCeiling` returning 0 is the true answer; treating it as a window
    // is what produced "até 0k" and a clamp to zero (D15.10).
    expect(
      conversationWindow({ locked: false, reserved: undefined, ceiling: 0, costed: true })
    ).toEqual({
      status: 'too-large'
    })
  })

  it('honours a locked window for an Ollama model whose RAM cost could not be computed', () => {
    // A null ceiling means "no basis to refuse", never "free" — distinct from
    // `costed: false` (cloud, N-1-C), which means there was never a RAM cost
    // to begin with, not that this particular model's cost is unknown.
    expect(
      conversationWindow({ locked: true, reserved: 16_384, ceiling: null, costed: true })
    ).toEqual({
      status: 'locked',
      numCtx: 16_384
    })
  })

  // N-1-C, DN1C.2: num_ctx never reaches a cloud provider — nothing is
  // allocated, so nothing can become unaffordable later, and the lock has
  // nothing to protect. `costed: false` always re-derives, even `locked`.
  describe('costed: false (cloud, N-1-C)', () => {
    it('never locks, even once the conversation has turns', () => {
      expect(
        conversationWindow({ locked: true, reserved: 32_768, ceiling: 1_048_576, costed: false })
      ).toEqual({
        status: 'open',
        numCtx: 32_768
      })
    })

    it('repairs a conversation already locked at a stale value from before this fix', () => {
      // The exact shape of the bug this plan fixes: an old conversation whose
      // `reserved` was written while `ceiling` was wrongly null (DEFAULT_NUM_CTX,
      // unclamped). Re-derived against the real ceiling, not frozen.
      expect(
        conversationWindow({ locked: true, reserved: 32_768, ceiling: 200_000, costed: false })
      ).toEqual({
        status: 'open',
        numCtx: 32_768
      })
    })

    it('is never unaffordable, no matter how large the reserved value', () => {
      expect(
        conversationWindow({ locked: true, reserved: 999_999, ceiling: 200_000, costed: false })
      ).toEqual({
        status: 'open',
        numCtx: 200_000
      })
    })
  })
})
