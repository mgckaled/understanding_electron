import { sniffImageMimeType, sniffRasterFormat } from './sniff'

describe('sniffImageMimeType', () => {
  it('identifies PNG from its magic bytes', () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(sniffImageMimeType(bytes)).toBe('image/png')
  })

  it('identifies JPEG from its magic bytes', () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
    expect(sniffImageMimeType(bytes)).toBe('image/jpeg')
  })

  it('returns null for bytes matching neither format', () => {
    expect(sniffImageMimeType(Buffer.from('not an image', 'utf8'))).toBeNull()
  })

  it('returns null for a buffer shorter than the magic bytes', () => {
    expect(sniffImageMimeType(Buffer.from([0x89, 0x50]))).toBeNull()
  })

  it('returns null for a source format that still needs rasterizing (D17.7)', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')
    expect(sniffImageMimeType(svg)).toBeNull()
  })
})

describe('sniffRasterFormat', () => {
  it('identifies WebP from its RIFF/WEBP container', () => {
    const bytes = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0x1a, 0x02, 0x00, 0x00]),
      Buffer.from('WEBP', 'ascii')
    ])
    expect(sniffRasterFormat(bytes)).toBe('image/webp')
  })

  it('does not confuse another RIFF container (e.g. WAV) for WebP', () => {
    const bytes = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('WAVE', 'ascii')
    ])
    expect(sniffRasterFormat(bytes)).toBeNull()
  })

  it('identifies a plain SVG root element', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')
    expect(sniffRasterFormat(svg)).toBe('image/svg+xml')
  })

  it('identifies an SVG whose root sits past a long license-comment preamble', () => {
    // A DOCTYPE plus a design-tool license block routinely runs past a
    // couple hundred bytes — the 4 KiB scan window has to reach past that.
    const preamble = `<!-- ${'x'.repeat(2000)} -->\n`
    const svg = Buffer.from(
      `<?xml version="1.0"?>\n<!DOCTYPE svg>\n${preamble}<svg xmlns="http://www.w3.org/2000/svg"></svg>`
    )
    expect(sniffRasterFormat(svg)).toBe('image/svg+xml')
  })

  it('identifies an SVG preceded by an XML declaration and a comment', () => {
    const svg = Buffer.from(
      '<?xml version="1.0"?>\n<!-- generated -->\n<svg xmlns="http://www.w3.org/2000/svg"></svg>'
    )
    expect(sniffRasterFormat(svg)).toBe('image/svg+xml')
  })

  it('does not match "svg" as a mere substring, only the root element tag', () => {
    expect(sniffRasterFormat(Buffer.from('this file mentions svg but is not one'))).toBeNull()
    expect(
      sniffRasterFormat(Buffer.from('<svgWrapper>not the real element</svgWrapper>'))
    ).toBeNull()
  })

  it('returns null for PNG/JPEG — those are already normalized, sniffImageMimeType owns them', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(sniffRasterFormat(png)).toBeNull()
  })
})
