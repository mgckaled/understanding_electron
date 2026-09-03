import { flattenReasoning } from './reasoningText'

describe('flattenReasoning', () => {
  it('flattens bold, a numbered list, a code fence and a GFM table into one paragraph, nothing dropped', () => {
    const reasoning =
      '1. **Primeiro:** confira o arquivo.\n' +
      '2. Depois rode `pytest`.\n' +
      '\n' +
      '```py\n' +
      'def f():\n' +
      '    return 1\n' +
      '```\n' +
      '\n' +
      '| Nome | Valor |\n' +
      '| --- | --- |\n' +
      '| Total | 42 |'

    expect(flattenReasoning(reasoning)).toBe(
      'Primeiro: confira o arquivo. Depois rode pytest. def f(): return 1 Nome Valor Total 42'
    )
  })

  it('keeps a fence left open by a partial stream, content included', () => {
    const partial = 'Aqui está:\n\n```python\ndef f():\n    return 1\n'

    expect(flattenReasoning(partial)).toBe('Aqui está: def f(): return 1')
  })

  it('leaves an unclosed ** as literal text instead of forming emphasis', () => {
    expect(flattenReasoning('**incompleto')).toBe('**incompleto')
  })

  it('returns empty string for empty or whitespace-only input', () => {
    expect(flattenReasoning('')).toBe('')
    expect(flattenReasoning('   \n  ')).toBe('')
  })
})
