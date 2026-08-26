import type { ArtifactRef } from './artifactContext'

/**
 * Whether this artifact's content can reach the clipboard at all.
 *
 * Image cannot, today. The bytes live behind `attachment://`, and the renderer
 * has three ways to them, all closed: `fetch` is rejected by CORS before the
 * CSP is even consulted, because the scheme lacks the `corsEnabled` privilege;
 * drawing the rendered `<img>` to a canvas taints it, so `toBlob` throws; and
 * no IPC channel serves image bytes. Reopening this is a decision about the
 * security registration, not a fix — see DF3A.7.
 */
export function canCopy(ref: ArtifactRef): boolean {
  return ref.kind === 'document'
}

/**
 * Puts the artifact's own content on the clipboard.
 *
 * @returns `true` when the clipboard was written.
 */
export async function copyArtifact(ref: ArtifactRef): Promise<boolean> {
  if (ref.kind !== 'document') return false
  try {
    await navigator.clipboard.writeText(ref.part.text)
    return true
  } catch {
    // Denied permission, or a browser without the API — both mean the same
    // thing to the user, and the button simply does not confirm.
    return false
  }
}
