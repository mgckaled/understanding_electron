import { toHtml } from './toHtml'

/** The mapping lives in the body; the stylesheet is not a decision about content. */
function body(markdown: string): string {
  return /<body>([\s\S]*)<\/body>/.exec(toHtml(markdown))?.[1] ?? ''
}

describe('toHtml', () => {
  it('carries the heading level into the tag', () => {
    expect(body('# Um\n\n### Três')).toBe('<h1>Um</h1><h3>Três</h3>')
  })

  it('nests the inline marks instead of flattening them', () => {
    expect(body('**forte *e torto*** e `código`')).toBe(
      '<p><strong>forte </strong><strong><em>e torto</em></strong> e <code>código</code></p>'
    )
  })

  it('keeps a strikethrough and drops a link target', () => {
    expect(body('~~foi~~ [ver](https://a.com)')).toBe('<p><s>foi</s> ver</p>')
  })

  it('turns a bullet list into a real ul', () => {
    expect(body('- um\n- dois')).toBe('<ul><li>um</li><li>dois</li></ul>')
  })

  it('turns a numbered list into a real ol', () => {
    expect(body('1. um\n2. dois')).toBe('<ol><li>um</li><li>dois</li></ol>')
  })

  it('opens and closes a nested list at the right depth', () => {
    expect(body('- um\n  - dentro\n- fora')).toBe(
      '<ul><li>um</li><ul><li>dentro</li></ul><li>fora</li></ul>'
    )
  })

  it('starts a new list when the marker changes at the same depth', () => {
    expect(body('- um\n\n1. dois')).toBe('<ul><li>um</li></ul><ol><li>dois</li></ol>')
  })

  it('closes every open list before a paragraph', () => {
    expect(body('- um\n  - dentro\n\nfim')).toBe(
      '<ul><li>um</li><ul><li>dentro</li></ul></ul><p>fim</p>'
    )
  })

  // Inside <pre> a break has to be a real newline, or the source stops being
  // copyable out of the PDF.
  it('keeps a code block as newlines inside pre, not br', () => {
    expect(body('```ts\nconst a = 1\n  const b = 2\n```')).toBe(
      '<pre><code>const a = 1\n  const b = 2</code></pre>'
    )
  })

  it('separates the table header so the browser can repeat it', () => {
    expect(body('| a | b |\n| --- | --- |\n| 1 | 2 |')).toBe(
      '<table><thead><tr><th><strong>a</strong></th><th><strong>b</strong></th></tr></thead>' +
        '<tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
    )
  })

  it('emits a quote and a rule', () => {
    expect(body('> citado\n\n---')).toBe('<blockquote><p>citado</p></blockquote><hr>')
  })

  it('turns a hard break into a br inside the paragraph', () => {
    expect(body('uma  \noutra')).toBe('<p>uma<br>outra</p>')
  })

  // DE1F.3: the draft is model text, and this is the line between a feature and
  // a leak. Removing the escape has to turn this test red.
  it.each([
    ['<script>alert(1)</script>', '&lt;script&gt;alert(1)&lt;/script&gt;'],
    ['<img src=x onerror=alert(1)>', '&lt;img src=x onerror=alert(1)&gt;'],
    ['a & b', 'a &amp; b']
  ])('escapes %s instead of emitting it', (input, expected) => {
    const out = body(input)

    expect(out).toContain(expected)
    // The escaped text still READS as `onerror=…`; what must not exist is a tag
    // that opens. Asserting on the payload string instead would be vacuous.
    expect(out).not.toContain('<script')
    expect(out).not.toContain('<img')
  })

  it('escapes inside a code block too', () => {
    expect(body('```html\n<b>oi</b>\n```')).toBe('<pre><code>&lt;b&gt;oi&lt;/b&gt;</code></pre>')
  })

  it('declares the policy and the page size in the document itself', () => {
    const html = toHtml('oi')

    expect(html).toMatch(/^<!doctype html>/)
    expect(html).toContain(`content="default-src 'none'"`)
    expect(html).toContain('@page { size: A4; margin: 2cm }')
    expect(html).toContain('<meta charset="utf-8">')
  })

  it('gives an empty draft an empty body', () => {
    expect(body('')).toBe('')
  })
})
