import { ok, err } from './result'

describe('ok', () => {
  it('wraps a value in a successful Result', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 })
  })
})

describe('err', () => {
  it('wraps an error in a failed Result', () => {
    expect(err({ kind: 'cancelled' })).toEqual({ ok: false, error: { kind: 'cancelled' } })
  })
})
