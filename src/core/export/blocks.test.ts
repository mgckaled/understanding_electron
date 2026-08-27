import { toBlocks } from './blocks'

describe('toBlocks', () => {
  it('carries the heading depth', () => {
    expect(toBlocks('# Um\n\n### Três')).toEqual([
      { kind: 'heading', level: 1, runs: [{ text: 'Um' }] },
      { kind: 'heading', level: 3, runs: [{ text: 'Três' }] }
    ])
  })

  it('splits a paragraph into runs that carry their own emphasis', () => {
    const [block] = toBlocks('Vendas **subiram** e *caíram*.')

    expect(block.runs).toEqual([
      { text: 'Vendas ' },
      { text: 'subiram', bold: true },
      { text: ' e ' },
      { text: 'caíram', italic: true },
      { text: '.' }
    ])
  })

  it('nests emphasis inside strong instead of losing one of them', () => {
    const [block] = toBlocks('**muito *mesmo***')

    expect(block.runs).toEqual([
      { text: 'muito ', bold: true },
      { text: 'mesmo', bold: true, italic: true }
    ])
  })

  it('marks inline code and strikethrough', () => {
    const [block] = toBlocks('Use `npm` ~~ou não~~')

    expect(block.runs).toEqual([
      { text: 'Use ' },
      { text: 'npm', mono: true },
      { text: ' ' },
      { text: 'ou não', strike: true }
    ])
  })

  it('keeps a link text and drops its target', () => {
    const [block] = toBlocks('Veja o [relatório](https://exemplo.com).')

    expect(block.runs).toEqual([{ text: 'Veja o ' }, { text: 'relatório' }, { text: '.' }])
  })

  it('breaks a code block into one line per run, all monospaced', () => {
    expect(toBlocks('```js\nconst a = 1\nconst b = 2\n```')).toEqual([
      {
        kind: 'code',
        runs: [
          { text: 'const a = 1', mono: true },
          { text: 'const b = 2', mono: true, newLine: true }
        ]
      }
    ])
  })

  it('marks a bullet list and an ordered list apart, both at level zero', () => {
    expect(toBlocks('- um\n- dois')).toEqual([
      { kind: 'paragraph', runs: [{ text: 'um' }], list: { ordered: false, level: 0 } },
      { kind: 'paragraph', runs: [{ text: 'dois' }], list: { ordered: false, level: 0 } }
    ])
    expect(toBlocks('1. um')[0].list).toEqual({ ordered: true, level: 0 })
  })

  it('deepens the level on a nested list', () => {
    const blocks = toBlocks('- um\n  - dentro\n    - mais fundo')

    expect(blocks.map((block) => block.list?.level)).toEqual([0, 1, 2])
  })

  // DE1E.4: Word needs the levels declared up front, so anything past the last
  // declared one is pinned instead of asking for a level that does not exist.
  it('pins the nesting at the deepest declared level', () => {
    const markdown = [
      '- 0',
      '  - 1',
      '    - 2',
      '      - 3',
      '        - 4',
      '          - 5',
      '            - 6'
    ].join('\n')

    expect(toBlocks(markdown).map((block) => block.list?.level)).toEqual([0, 1, 2, 3, 4, 4, 4])
  })

  it('keeps the emphasis of a run inside a list item', () => {
    const [block] = toBlocks('- um **forte**')

    expect(block.runs).toEqual([{ text: 'um ' }, { text: 'forte', bold: true }])
    expect(block.list).toEqual({ ordered: false, level: 0 })
  })

  it('turns a quote into its own kind', () => {
    expect(toBlocks('> citado')).toEqual([{ kind: 'quote', runs: [{ text: 'citado' }] }])
  })

  it('keeps a rule even though it carries no runs', () => {
    expect(toBlocks('antes\n\n---\n\ndepois')).toEqual([
      { kind: 'paragraph', runs: [{ text: 'antes' }] },
      { kind: 'rule', runs: [] },
      { kind: 'paragraph', runs: [{ text: 'depois' }] }
    ])
  })

  it('flattens a table into one block per row, header in bold', () => {
    const blocks = toBlocks('| Mês | Vendas |\n| --- | --- |\n| Jan | 120 |')

    expect(blocks).toEqual([
      {
        kind: 'paragraph',
        runs: [{ text: 'Mês', bold: true }, { text: '\t' }, { text: 'Vendas', bold: true }]
      },
      { kind: 'paragraph', runs: [{ text: 'Jan' }, { text: '\t' }, { text: '120' }] }
    ])
  })

  it('turns a hard break into a new line inside the same block', () => {
    const [block] = toBlocks('uma  \noutra')

    expect(block.runs).toEqual([{ text: 'uma' }, { text: '', newLine: true }, { text: 'outra' }])
  })

  // DE1E.7: an image has no bytes to embed here, and silence would be worse.
  it('keeps an image as its alternative text', () => {
    const [block] = toBlocks('![o gráfico de vendas](attachment://abc)')

    expect(block.runs).toEqual([{ text: 'o gráfico de vendas' }])
  })

  it('does not swallow raw html', () => {
    expect(toBlocks('<div>oi</div>')).toEqual([
      { kind: 'paragraph', runs: [{ text: '<div>oi</div>' }] }
    ])
  })

  it('gives an empty draft no blocks at all', () => {
    expect(toBlocks('')).toEqual([])
    expect(toBlocks('   \n\n  ')).toEqual([])
  })
})
