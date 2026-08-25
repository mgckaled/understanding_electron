import { cx } from './cx'

describe('cx', () => {
  it('joins truthy fragments with a space', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c')
  })

  it('drops falsy fragments', () => {
    expect(cx('a', false, null, undefined, '', 'b')).toBe('a b')
  })

  it('returns an empty string when nothing is truthy', () => {
    expect(cx(false, undefined)).toBe('')
  })
})
