const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff])

/**
 * Identifies PNG/JPEG from magic bytes, not the source path's extension —
 * the content-addressed store (D16.3) keeps blobs with no extension in the
 * name, so both `attachImage` (D17.2) and the `attachment://` protocol
 * (D17.6) need this. `null` for anything else, including SVG/WebP (D17.7,
 * not yet accepted).
 */
export function sniffImageMimeType(bytes: Buffer): 'image/png' | 'image/jpeg' | null {
  if (bytes.subarray(0, 4).equals(PNG_MAGIC)) return 'image/png'
  if (bytes.subarray(0, 3).equals(JPEG_MAGIC)) return 'image/jpeg'
  return null
}
