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

  it('still produces a valid file from an empty draft', async () => {
    const bytes = await toDocx('')

    expect([...bytes.slice(0, 4)]).toEqual(ZIP_MAGIC)
  })
})
