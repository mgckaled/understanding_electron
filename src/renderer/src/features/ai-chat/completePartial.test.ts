import { completePartial } from './completePartial'

describe('completePartial', () => {
  it('leaves an empty string untouched', () => {
    expect(completePartial('')).toBe('')
  })

  it('leaves text without markup untouched', () => {
    expect(completePartial('texto simples sem marcação')).toBe('texto simples sem marcação')
  })

  it('closes an open fenced block', () => {
    expect(completePartial('```csv\nID,Nome')).toBe('```csv\nID,Nome\n```')
  })

  it('closes only the second fence when the first is already paired', () => {
    expect(completePartial('```a\ncode\n```\n```b\nmore')).toBe('```a\ncode\n```\n```b\nmore\n```')
  })

  it('closes an odd inline backtick', () => {
    expect(completePartial('`col')).toBe('`col`')
  })

  it('closes an odd bold marker', () => {
    expect(completePartial('**Resu')).toBe('**Resu**')
  })

  it('closes only the third bold marker', () => {
    expect(completePartial('**a** e **b')).toBe('**a** e **b**')
  })

  it('does not balance a `**` that lives inside an open fence — it is code', () => {
    expect(completePartial('```\n**bold')).toBe('```\n**bold\n```')
  })
})
