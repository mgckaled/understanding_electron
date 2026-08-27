import { draftTitle } from './title'

describe('draftTitle', () => {
  it('takes the first line as it is', () => {
    expect(draftTitle('Vendas do trimestre\n\nO resto do texto.')).toBe('Vendas do trimestre')
  })

  it('skips blank lines before the first prose', () => {
    expect(draftTitle('\n\n  \nVendas do trimestre')).toBe('Vendas do trimestre')
  })

  it.each([
    ['## Vendas do trimestre', 'Vendas do trimestre'],
    ['> Vendas do trimestre', 'Vendas do trimestre'],
    ['- Vendas do trimestre', 'Vendas do trimestre'],
    ['3) Vendas do trimestre', 'Vendas do trimestre'],
    ['**Vendas** do `trimestre`', 'Vendas do trimestre']
  ])('unmarks %s', (content, expected) => {
    expect(draftTitle(content)).toBe(expected)
  })

  // A heading with nothing after it is a real first line in a model answer that
  // starts with a separator — the second line is the one that names anything.
  it('walks past a line that is nothing but marks', () => {
    expect(draftTitle('###\nVendas do trimestre')).toBe('Vendas do trimestre')
  })

  it('walks past a rule line', () => {
    expect(draftTitle('---\nVendas do trimestre')).toBe('Vendas do trimestre')
  })

  it('cuts a long line and marks the cut', () => {
    const title = draftTitle('a'.repeat(200))

    expect(title).toHaveLength(61)
    expect(title.endsWith('…')).toBe(true)
  })

  it('does not cut a line that fits', () => {
    const line = 'a'.repeat(60)

    expect(draftTitle(line)).toBe(line)
  })

  it.each([
    ['', 'empty'],
    ['   \n\n  ', 'blank'],
    ['##  \n>  ', 'marks only']
  ])('falls back on %s content (%s)', (content) => {
    expect(draftTitle(content)).toBe('Rascunho sem título')
  })
})
