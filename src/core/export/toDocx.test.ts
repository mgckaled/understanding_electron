import { toDocx } from './toDocx'

/** The local file header every ZIP starts with — a `.docx` is a ZIP. */
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]

const MARKDOWN = [
  '# Vendas',
  '',
  'Subiram **12%**.',
  '',
  '1. primeiro',
  '2. segundo',
  '',
  '```js',
  'const a = 1',
  '```',
  '',
  '---',
  '',
  '> citado'
].join('\n')

describe('toDocx', () => {
  it('produces a zip archive, which is what a docx is', async () => {
    const bytes = await toDocx(MARKDOWN)

    expect([...bytes.slice(0, 4)]).toEqual(ZIP_MAGIC)
    expect(bytes.byteLength).toBeGreaterThan(1000)
  })

  // Every block kind goes through Paragraph at once: a level asking for
  // numbering that was never declared throws here, not in Word (DE1E.4).
  it('renders every block kind without refusing one', async () => {
    const deep = ['- a', '  - b', '    - c', '      - d', '        - e', '          - f'].join('\n')

    await expect(toDocx(`${MARKDOWN}\n\n${deep}`)).resolves.toBeInstanceOf(Uint8Array)
  })

  // DE1E.10: a Table is not a Paragraph, so the section has to accept both —
  // a mistake here throws at construction, not in Word.
  it('accepts a table alongside paragraphs in the same section', async () => {
    const withTable = `${MARKDOWN}\n\n| Mês | Vendas |\n| --- | --- |\n| Jan | 120 |`

    await expect(toDocx(withTable)).resolves.toBeInstanceOf(Uint8Array)
  })

  it('still produces a valid file from an empty draft', async () => {
    const bytes = await toDocx('')

    expect([...bytes.slice(0, 4)]).toEqual(ZIP_MAGIC)
  })
})
