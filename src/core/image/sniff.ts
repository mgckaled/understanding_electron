const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff])

/**
 * Identifies PNG/JPEG from magic bytes, not the source path's extension —
 * the content-addressed store (D16.3) keeps blobs with no extension in the
 * name, so both `attachImage` (D17.2) and the `attachment://` protocol
 * (D17.6) need this. Stored bytes are always one of these two: SVG/WebP are
 * rasterized to PNG before storage (D17.7), so `null` here means the source
 * was neither — `sniffRasterFormat` is the check for THAT, on the source
 * file, before it reaches the store.
 */
export function sniffImageMimeType(bytes: Buffer): 'image/png' | 'image/jpeg' | null {
  if (bytes.subarray(0, 4).equals(PNG_MAGIC)) return 'image/png'
  if (bytes.subarray(0, 3).equals(JPEG_MAGIC)) return 'image/jpeg'
  return null
}

export type RasterFormat = 'image/svg+xml' | 'image/webp'

const WEBP_RIFF = Buffer.from('RIFF', 'ascii')
const WEBP_WEBP = Buffer.from('WEBP', 'ascii')

/**
 * Identifies a SOURCE file that needs {@link RasterFormat}'s conversion to
 * PNG before it can be stored (D17.7) — the counterpart to
 * {@link sniffImageMimeType}, which only ever sees the normalized output.
 * WebP has magic bytes (`RIFF….WEBP`); SVG has none — it is XML text, so the
 * check tolerates a BOM, XML declaration, doctype or comment ahead of the
 * root element, all legal in a real SVG file.
 */
export function sniffRasterFormat(bytes: Buffer): RasterFormat | null {
  if (bytes.subarray(0, 4).equals(WEBP_RIFF) && bytes.subarray(8, 12).equals(WEBP_WEBP)) {
    return 'image/webp'
  }
  // 4 KiB, not a tighter guess: an XML declaration plus a DOCTYPE and a
  // license-comment block (common from design tools) can push the real
  // `<svg` root well past a couple hundred bytes.
  if (/<svg[\s>]/i.test(bytes.subarray(0, 4096).toString('utf8'))) return 'image/svg+xml'
  return null
}
