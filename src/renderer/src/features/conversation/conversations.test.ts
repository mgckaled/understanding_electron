import { DEFAULT_TITLE, stoppedFromError, titleFromText } from './conversations'

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

describe('stoppedFromError', () => {
  it('maps the two interruptions to their own markers', () => {
    expect(stoppedFromError({ kind: 'cancelled' })).toBe('cancelled')
    expect(stoppedFromError({ kind: 'timeout', afterMs: 1000 })).toBe('timeout')
  })

  it('maps a failure of the call itself to no marker at all', () => {
    // Nothing was cut short here: the request never produced a reply, so there
    // is no partial to keep and a marker would claim otherwise.
    expect(stoppedFromError({ kind: 'unavailable', service: 'ollama', hint: 'x' })).toBeNull()
    expect(
      stoppedFromError({ kind: 'upstream', service: 'ollama', status: 500, message: 'x' })
    ).toBeNull()
  })
})
