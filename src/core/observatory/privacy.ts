import type { AiService, Message } from '@shared/ipc'

/** What a cloud `chat()` call hands to whoever persists it (O-8, § 9.3/DO8.4). */
export type PrivacyEvent = {
  service: AiService
  model: string
  datasetCount: number
  documentCount: number
  imageCount: number
}

/**
 * Attachment parts across every message, by kind — not routed through
 * `attachmentPartOf` (`core/ai/messages.ts`), whose `.find` semantics answer
 * "which card does this bubble draw" (at most one), not "how many attachment
 * parts does this message carry" (DO8's revised step 2).
 */
export function countAttachments(
  messages: Message[]
): Pick<PrivacyEvent, 'datasetCount' | 'documentCount' | 'imageCount'> {
  let datasetCount = 0
  let documentCount = 0
  let imageCount = 0
  for (const message of messages) {
    for (const part of message.parts) {
      // A Context7 consultation is deliberately not counted here (D23C.9), and
      // never will be: it gets a panel and a table of its own (O-9). This one
      // also never sees the question sent TO Context7, which leaves the machine
      // even in a fully local conversation (DM-22) — same owner.
      if (part.kind === 'dataset') datasetCount++
      else if (part.kind === 'document') documentCount++
      else if (part.kind === 'image') imageCount++
    }
  }
  return { datasetCount, documentCount, imageCount }
}
