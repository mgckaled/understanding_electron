import { decodeText } from './extractText'

describe('decodeText', () => {
  it('decodes UTF-8 without a BOM', () => {
    expect(decodeText(Buffer.from('endereço', 'utf8'))).toBe('endereço')
  })

  it('strips a UTF-8 BOM', () => {
    const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('ok', 'utf8')])
    expect(decodeText(withBom)).toBe('ok')
  })

  it('falls back to windows-1252 for bytes invalid as UTF-8 (D17.13)', () => {
    // 0x93/0x94/0x97 are curly quotes and an em dash in windows-1252 — what
    // text pasted from Word in Portuguese uses. Alone, each is an invalid
    // UTF-8 continuation byte, which is what triggers the fallback.
    const buffer = Buffer.from([0x93, 0x41, 0x94, 0x97])
    expect(decodeText(buffer)).toBe('“A”—')
  })
})
