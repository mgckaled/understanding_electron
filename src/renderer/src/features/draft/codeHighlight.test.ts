import { LANGUAGE_IDS, resolveLanguage } from '@core/draft/languages'
import { HIGHLIGHTED_IDS, grammarFor } from './codeHighlight'

describe('grammarFor', () => {
  it.each(['python', 'sql', 'typescript', 'dockerfile', 'markdown'])(
    'has a grammar for %s',
    (id) => {
      expect(grammarFor(id)).not.toBeNull()
    }
  )

  // DE2B.4: no guess. An unknown fence is plain text, which is what the E-2-A
  // had to restore after markdown's rules mangled code.
  it.each([null, undefined, 'brainfuck', ''])('has none for %s', (id) => {
    expect(grammarFor(id)).toBeNull()
  })

  // The two tables are written apart — one in core/, one in the renderer — so
  // this is what keeps them honest: every id the app can resolve a fence to
  // must be an id the editor knows how to colour.
  it('covers every language the fence table resolves to', () => {
    const unknown = HIGHLIGHTED_IDS.filter((id) => resolveLanguage(id) === null)
    expect(unknown).toEqual([])
  })

  // The direction that bites: a fence that resolves but has no grammar would
  // store fine, name its file right, and silently come out uncoloured.
  it('leaves no resolvable language without a grammar', () => {
    expect(LANGUAGE_IDS.filter((id) => grammarFor(id) === null)).toEqual([])
  })

  it.each(['py', 'ts', 'postgres', 'c++', 'yml', 'golang'])(
    'reaches a grammar from the alias %s',
    (alias) => {
      expect(grammarFor(resolveLanguage(alias)?.id)).not.toBeNull()
    }
  )
})
