import type { AttachmentPart, Message } from '@shared/ipc'
import { attachmentPartsOf } from '@core/ai/messages'
import type { ArtifactRef } from './artifactContext'

/**
 * The artifact for an attachment, or `null` when the panel cannot show it yet.
 *
 * Which kinds are openable is a renderer fact — it is the membership of
 * {@link ArtifactRef} — so it is decided here and not in `core/`, which has no
 * opinion about what gets drawn. Every kind is openable since F-3-D, and the
 * `null` stays for the next one that is not.
 */
export function toArtifactRef(part: AttachmentPart): ArtifactRef | null {
  switch (part.kind) {
    case 'document':
      return { kind: 'document', id: part.hash, part }
    case 'image':
      return { kind: 'image', id: part.hash, part }
    case 'dataset':
      return { kind: 'dataset', id: part.hash, part }
  }
}

/**
 * Every artifact in the transcript the panel can open, oldest first (DF3B.7).
 *
 * Feeds both the header clip's count and the panel's own picker, so the number
 * on the clip and the length of the list can never disagree.
 */
export function artifactsOf(messages: Message[]): ArtifactRef[] {
  return attachmentPartsOf(messages)
    .map(toArtifactRef)
    .filter((ref): ref is ArtifactRef => ref !== null)
}
