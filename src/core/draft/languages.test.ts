import { FALLBACK_EXTENSION, resolveLanguage } from './languages'
import { codeFileName } from '../export/fileName'

describe('resolveLanguage', () => {
  it.each([
    ['python', 'python', 'py'],
    ['py', 'python', 'py'],
    ['python3', 'python', 'py'],
    ['ts', 'typescript', 'ts'],
    ['postgres', 'sql', 'sql'],
    ['sh', 'bash', 'sh'],
    ['c++', 'cpp', 'cpp'],
    ['c#', 'csharp', 'cs'],
    ['golang', 'go', 'go'],
    ['yml', 'yaml', 'yaml']
  ])('resolves %s to %s', (fence, id, extension) => {
    expect(resolveLanguage(fence)).toMatchObject({ id, extension })
  })

  // The info string is written by a model, so its shape is not guaranteed.
  it.each(['PYTHON', ' Python ', 'Py'])('is case and space insensitive for %s', (fence) => {
    expect(resolveLanguage(fence)?.id).toBe('python')
  })

  it.each([
    ['a fence that named none', null],
    ['a language we do not know', 'brainfuck'],
    ['an empty info string', '']
  ])('returns null for %s', (_case, fence) => {
    expect(resolveLanguage(fence)).toBeNull()
  })

  // Every alias must land on a language that declares an extension, or the
  // export would compose a name ending in "undefined".
  it('gives every entry a non-empty extension without a leading dot', () => {
    for (const fence of ['python', 'sql', 'dockerfile', 'r', 'diff', 'markdown']) {
      const extension = resolveLanguage(fence)?.extension
      expect(extension).toBeTruthy()
      expect(extension?.startsWith('.')).toBe(false)
    }
  })
})

describe('codeFileName', () => {
  it('appends the extension of the resolved language', () => {
    expect(codeFileName('analise', resolveLanguage('py'))).toBe('analise.py')
  })

  it.each([null, 'brainfuck'])('falls back to .txt for %s', (fence) => {
    expect(codeFileName('analise', resolveLanguage(fence))).toBe(`analise.${FALLBACK_EXTENSION}`)
  })

  // DE2B.3: dockerfile is a whole file name, not a suffix — the Linguist models
  // it under `filenames`, and the title has no part in it.
  it('replaces the title entirely for a language named by file', () => {
    expect(codeFileName('meu trecho', resolveLanguage('dockerfile'))).toBe('Dockerfile')
  })

  // It goes through exportFileName, so it inherits the Windows sanitising
  // rather than reimplementing it.
  it('sanitises a title Windows would reject', () => {
    expect(codeFileName('a/b:c', resolveLanguage('sql'))).toBe('a b c.sql')
  })

  it('escapes a reserved device name', () => {
    expect(codeFileName('CON', resolveLanguage('py'))).toBe('CON_.py')
  })
})
