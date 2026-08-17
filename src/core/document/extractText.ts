const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf])

/**
 * Decodes a .txt/.md attachment's raw bytes (D17.13): strips a UTF-8 BOM when
 * present, else tries strict UTF-8 and falls back to windows-1252 — the pair
 * docs/ESCOPO.md names as plausible for text pasted from Word in Portuguese.
 */
export function decodeText(buffer: Buffer): string {
  const bytes = buffer.subarray(0, 3).equals(UTF8_BOM) ? buffer.subarray(3) : buffer
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}
