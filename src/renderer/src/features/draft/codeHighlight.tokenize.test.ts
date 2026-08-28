import { tokenize } from './codeHighlight'

/** The text of every token, rejoined — what the reader actually sees. */
function textOf(lines: NonNullable<ReturnType<typeof tokenize>>): string {
  return lines.map((tokens) => tokens.map((token) => token.text).join('')).join('\n')
}

function classesOf(lines: NonNullable<ReturnType<typeof tokenize>>): Set<string> {
  return new Set(lines.flatMap((tokens) => tokens.flatMap((token) => token.classes.split(' '))))
}

describe('tokenize', () => {
  const PY = ['def greet(name):', '    return "Ola, " + name  # nota', ''].join('\n')

  // The whole point of the preview rewrite: nothing may be added, dropped or
  // reflowed. A highlighter that loses a space is the DE2A.9 defect again.
  it('reproduces the source exactly, spaces and blank lines included', () => {
    expect(textOf(tokenize(PY, 'python')!)).toBe(PY)
  })

  it('classifies keyword, string and comment', () => {
    const classes = classesOf(tokenize(PY, 'python')!)

    expect(classes).toContain('tok-keyword')
    expect(classes).toContain('tok-string')
    expect(classes).toContain('tok-comment')
  })

  it('splits one array per line', () => {
    expect(tokenize(PY, 'python')).toHaveLength(3)
  })

  // DE2B.4: no grammar, no guess — the caller renders the text plain.
  it.each([null, undefined, 'brainfuck'])('returns null for %s', (id) => {
    expect(tokenize(PY, id)).toBeNull()
  })

  it.each(['sql', 'typescript', 'yaml'])('emits classes for %s too', (id) => {
    const source = { sql: 'SELECT 1 -- c', typescript: 'const a = "x" // c', yaml: 'a: "x"' }[
      id
    ] as string

    expect(classesOf(tokenize(source, id)!).size).toBeGreaterThan(1)
  })
})
