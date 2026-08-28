import { draftTitle } from './title'

describe('draftTitle', () => {
  it('takes the first line as it is', () => {
    expect(draftTitle('Vendas do trimestre\n\nO resto do texto.', 'markdown')).toBe(
      'Vendas do trimestre'
    )
  })

  it('skips blank lines before the first prose', () => {
    expect(draftTitle('\n\n  \nVendas do trimestre', 'markdown')).toBe('Vendas do trimestre')
  })

  it.each([
    ['## Vendas do trimestre', 'Vendas do trimestre'],
    ['> Vendas do trimestre', 'Vendas do trimestre'],
    ['- Vendas do trimestre', 'Vendas do trimestre'],
    ['3) Vendas do trimestre', 'Vendas do trimestre'],
    ['**Vendas** do `trimestre`', 'Vendas do trimestre']
  ])('unmarks %s', (content, expected) => {
    expect(draftTitle(content, 'markdown')).toBe(expected)
  })

  // A heading with nothing after it is a real first line in a model answer that
  // starts with a separator — the second line is the one that names anything.
  it('walks past a line that is nothing but marks', () => {
    expect(draftTitle('###\nVendas do trimestre', 'markdown')).toBe('Vendas do trimestre')
  })

  it('walks past a rule line', () => {
    expect(draftTitle('---\nVendas do trimestre', 'markdown')).toBe('Vendas do trimestre')
  })

  it('cuts a long line and marks the cut', () => {
    const title = draftTitle('a'.repeat(200), 'markdown')

    expect(title).toHaveLength(61)
    expect(title.endsWith('…')).toBe(true)
  })

  it('does not cut a line that fits', () => {
    const line = 'a'.repeat(60)

    expect(draftTitle(line, 'markdown')).toBe(line)
  })

  // Code is the other dialect: the prose stripper would eat marks that are
  // syntax there (DE2A.4).
  describe('code', () => {
    it.each([
      ['# -*- coding: utf-8 -*-', '# -*- coding: utf-8 -*-'],
      ['import * as fs from "fs"', 'import * as fs from "fs"'],
      ['## heading-looking comment', '## heading-looking comment'],
      ['- not a bullet, a yaml item', '- not a bullet, a yaml item'],
      ['```', '```'],
      ['--- # yaml document separator', '--- # yaml document separator']
    ])('keeps %s intact', (content, expected) => {
      expect(draftTitle(content, 'code')).toBe(expected)
    })

    it('still skips blank lines and still cuts', () => {
      expect(draftTitle('   \n\n  def main():', 'code')).toBe('def main():')
      expect(draftTitle('x'.repeat(200), 'code')).toHaveLength(61)
    })

    it('falls back when there is nothing but whitespace', () => {
      expect(draftTitle('  \n\n ', 'code')).toBe('Rascunho sem título')
    })
  })

  it.each([
    ['', 'empty'],
    ['   \n\n  ', 'blank'],
    ['##  \n>  ', 'marks only']
  ])('falls back on %s content (%s)', (content) => {
    expect(draftTitle(content, 'markdown')).toBe('Rascunho sem título')
  })
})
