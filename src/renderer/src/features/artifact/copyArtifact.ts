import type { ImagePart } from '@shared/ipc'
import type { ArtifactRef } from './artifactContext'

/**
 * Whether this artifact's content can reach the clipboard at all.
 *
 * Tabular data leaves through export, in trilha E — not through here (DF3D.10).
 */
export function canCopy(ref: ArtifactRef): boolean {
  return ref.kind !== 'dataset'
}

/**
 * A PNG blob, whatever the stored format was.
 *
 * Chromium accepts only `image/png` in a `ClipboardItem`, and `ImagePart`
 * admits JPEG — which has no alpha, so re-encoding costs nothing that matters
 * (DF3E.1). The canvas is clean here because these bytes arrived over IPC, not
 * through the tainting `attachment://` image (DF3A.7).
 */
async function toPngBlob(bytes: Uint8Array, mimeType: ImagePart['mimeType']): Promise<Blob> {
  // Copied, not `bytes.buffer`: the contract's Uint8Array may be a view into a
  // larger buffer, and `.buffer` would hand Blob everything around it.
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType })
  // Switched on the mimeType, never on the fileName: D17.7 rasterises SVG and
  // WebP to PNG but keeps the original name, so `logo.svg` holds PNG (DF3E.2).
  switch (mimeType) {
    case 'image/png':
      return blob
    case 'image/jpeg': {
      const bitmap = await createImageBitmap(blob)
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext('2d')
      if (context === null) throw new Error('2d context unavailable')
      context.drawImage(bitmap, 0, 0)
      bitmap.close()
      return canvas.convertToBlob({ type: 'image/png' })
    }
  }
}

async function copyImage(part: ImagePart): Promise<boolean> {
  const response = await window.api.image.bytes(part.hash)
  if (!response.ok) return false

  const png = await toPngBlob(response.value, part.mimeType)
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
  return true
}

/**
 * Puts the artifact's own content on the clipboard.
 *
 * @returns `true` when the clipboard was written.
 */
export async function copyArtifact(ref: ArtifactRef): Promise<boolean> {
  try {
    switch (ref.kind) {
      case 'document':
        await navigator.clipboard.writeText(ref.part.text)
        return true
      case 'image':
        return await copyImage(ref.part)
      case 'dataset':
        return false
    }
  } catch {
    // Denied permission, a missing API, or an image that would not decode —
    // all the same to the user, and the button simply does not confirm.
    return false
  }
}
