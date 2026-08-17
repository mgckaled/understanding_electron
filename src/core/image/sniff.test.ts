import { sniffImageMimeType } from './sniff'

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
})
