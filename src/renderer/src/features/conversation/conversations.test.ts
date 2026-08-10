import { DEFAULT_TITLE, titleFromText } from './conversations'

/*
 * The reducer tests that used to live here are gone with the reducer: the list
 * and the transcripts are a server cache now, and what the reducer used to
 * assert (ordering, electing another conversation when the active one is
 * removed, titling from the first user message) is asserted where it now
 * happens — the level-3 handler tests and the level-2 tests of the view.
 */

describe('titleFromText', () => {
  it('collapses whitespace and keeps a short message whole', () => {
    expect(titleFromText('  duas   linhas\ne mais  ')).toBe('duas linhas e mais')
  })

  it('truncates a long message with an ellipsis', () => {
    const title = titleFromText('a'.repeat(80))
    expect(title).toHaveLength(48)
    expect(title.endsWith('…')).toBe(true)
  })

  it('falls back to the default for an empty message', () => {
    expect(titleFromText('   ')).toBe(DEFAULT_TITLE)
  })
})
