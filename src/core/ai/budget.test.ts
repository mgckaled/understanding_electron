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
})

/*
 * The lock (D15.13). What it buys is a denominator that stops moving: before
 * the first send the window is derived from free RAM at render time, after it
 * the recorded number stands.
 */
describe('conversationWindow', () => {
  it('derives the window while the conversation is still open', () => {
    expect(conversationWindow({ locked: false, reserved: undefined, ceiling: 32_768 })).toEqual({
      status: 'open',
      numCtx: 32_768
    })
  })

  it('clamps an open conversation to what the machine can hold', () => {
    expect(conversationWindow({ locked: false, reserved: 32_768, ceiling: 6006 })).toEqual({
      status: 'open',
      numCtx: 6006
    })
  })

  it('keeps a locked window even when more memory freed up', () => {
    // The point of the lock, and the direction that is easy to get wrong: a
    // ceiling that grew must not silently raise a reservation the model was
    // already loaded with.
    expect(conversationWindow({ locked: true, reserved: 8192, ceiling: 131_072 })).toEqual({
      status: 'locked',
      numCtx: 8192
    })
  })

  it('refuses instead of shrinking when the locked window no longer fits', () => {
    // The asymmetric failure mode: the reservation is remade on every load, and
    // free RAM varies by 3 GB on this machine. Shrinking in silence would undo
    // the guarantee the lock exists to give.
    expect(conversationWindow({ locked: true, reserved: 32_768, ceiling: 6006 })).toEqual({
      status: 'unaffordable',
      numCtx: 32_768
    })
  })

  it('locks a conversation from before the lock at what it can afford now', () => {
    // Its turns predate the pair being recorded, so there is nothing written
    // down to honour — it derives one, and its next send writes it.
    expect(conversationWindow({ locked: true, reserved: undefined, ceiling: 6006 })).toEqual({
      status: 'locked',
      numCtx: 6006
    })
  })

  it('reports too-large when the model does not fit at all', () => {
    // `contextCeiling` returning 0 is the true answer; treating it as a window
    // is what produced "até 0k" and a clamp to zero (D15.10).
    expect(conversationWindow({ locked: false, reserved: undefined, ceiling: 0 })).toEqual({
      status: 'too-large'
    })
  })

  it('honours a locked window for a model that could not be costed', () => {
    // A null ceiling means "no basis to refuse", never "free".
    expect(conversationWindow({ locked: true, reserved: 16_384, ceiling: null })).toEqual({
      status: 'locked',
      numCtx: 16_384
    })
  })
})
