import type { ArtifactRef } from './artifactContext'

/**
 * Puts the artifact's own content on the clipboard — text for a document, the
 * real bytes for an image.
 *
 * The image path goes through `fetch('attachment://…')`, which the CSP allows
 * only because `connect-src` names the scheme (DF3A.7). Drawing the rendered
 * `<img>` onto a canvas would avoid the CSP and does not work: a different
 * scheme is a different origin, so the canvas is tainted and `toBlob` throws.
 *
 * @returns `true` when the clipboard was written.
 */
export async function copyArtifact(ref: ArtifactRef): Promise<boolean> {
  try {
    if (ref.kind === 'document') {
      await navigator.clipboard.writeText(ref.part.text)
      return true
    }
    const response = await fetch(`attachment://${ref.part.hash}`)
    const blob = await response.blob()
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    return true
  } catch {
    // Denied permission, a blob that vanished, a browser without
    // ClipboardItem — all of them mean the same thing to the user, and the
    // button simply does not confirm.
    return false
  }
}
