import type {
  AiService,
  AppError,
  AttachmentPart,
  ChatMessage,
  ImagePart,
  Message,
  MessagePart
} from '@shared/ipc'
import { formatDataCard } from './dataCard'
import { formatDocumentCard } from './documentCard'

// Message is a list of typed parts; a provider wants flat `{ role, content }`.
// The translation lives in core/, not the renderer, because plano 16 hangs the
// three-level privacy boundary here — a decision two callers need belongs in
// core/, or validation next to one becomes a bypass in the second.

/** Whether `service` is a cloud provider — every non-'ollama' value is (N-1-B). */
export function isCloudService(service: AiService): boolean {
  return service !== 'ollama'
}

/**
 * The nível-3 refusal (`ESCOPO.md`): document and image are nível 3 by
 * construction, and the cloud blocks nível 3 outright. Reuses
 * `AppError.kind: 'blocked'` — the same shape a scanned PDF or an
 * unrecognized image format already returns — rather than a new kind.
 */
export function checkLevel3(messages: Message[], service: AiService): AppError | null {
  if (!isCloudService(service)) return null
  const hasRestrictedPart = messages.some((message) =>
    message.parts.some((part) => part.kind === 'document' || part.kind === 'image')
  )
  return hasRestrictedPart
    ? {
        kind: 'blocked',
        reason:
          'Documento e imagem são nível 3 — bloqueados em modelos de nuvem. Use um modelo local para este anexo.'
      }
    : null
}

/**
 * All the text a message carries, in order. Non-text parts contribute nothing
 * — deliberately: this feeds the sidebar title and the user's own bubble, and
 * neither may render a data card inline (D16.4 Passo 4 draws it as its own
 * element). The budget estimate reads {@link toChatMessages} instead (D16.5
 * Passo 5), since it must count what a non-text part costs the provider.
 */
export function messageText(message: Message): string {
  return message.parts
    .filter((part) => part.kind === 'text')
    .map((part) => part.text)
    .join('')
}

/** The attachment on a message, if any — the card the conversation draws (D16.4 Passo 4, generalized D17.4). */
export function attachmentPartOf(message: Message): AttachmentPart | null {
  return message.parts.find((part): part is AttachmentPart => part.kind !== 'text') ?? null
}

/** How many image parts a turn carries — the flat token cost the budget adds is this times `IMAGE_TOKEN_ESTIMATE` (D17.12). */
export function imageCountOf(messages: Message[]): number {
  return messages.reduce(
    (total, message) => total + message.parts.filter((part) => part.kind === 'image').length,
    0
  )
}

// What the PROVIDER receives for one part (D16.5) — the only place a non-text
// part materializes into content. A card is cheap (measured: 51-180 tokens at
// 5-40 columns, plano 16 passo 0) but paid every turn, so nothing here
// resummarizes it. Exported (D17.4): Composer counts a pending attachment's
// chars with this same function, instead of calling formatDataCard directly.
export function partForProvider(part: MessagePart): string {
  switch (part.kind) {
    case 'text':
      return part.text
    case 'dataset':
      return formatDataCard(part)
    case 'document':
      return formatDocumentCard(part)
    case 'image':
      // Contributes nothing to `content` — an image rides on ChatMessage.images
      // instead (D17.5), a separate field in the provider's own wire shape.
      return ''
  }
}

/**
 * One message's joined content — the single place that decides how parts
 * become text, shared by {@link toChatMessages} and
 * {@link toChatMessagesWithImages} so the two can never drift apart (an
 * image part contributing `''` is filtered here, not re-filtered per caller).
 */
function contentOf(message: Message): string {
  return message.parts
    .map(partForProvider)
    .filter((text) => text !== '')
    .join('\n\n')
}

/** The conversation as the provider sees it — text and cards only, no image bytes (those need `fs`, D17.5). */
export function toChatMessages(messages: Message[]): ChatMessage[] {
  return messages.map((message) => ({ role: message.role, content: contentOf(message) }))
}

/**
 * Same translation as {@link toChatMessages}, plus base64 image bytes
 * (D17.5) — async and main-only: a sandboxed renderer has no `fs` to read
 * `userData/attachments/<hash>` with. `resolveImageBytes` is injected, same
 * DIP as `attachDataset`'s `createHashedLines`. Iterates `messages` directly,
 * never a second array kept in step with it by index.
 */
export async function toChatMessagesWithImages(
  messages: Message[],
  resolveImageBytes: (hash: string) => Promise<Buffer>
): Promise<ChatMessage[]> {
  const result: ChatMessage[] = []
  for (const message of messages) {
    const imageParts = message.parts.filter((part): part is ImagePart => part.kind === 'image')
    if (imageParts.length === 0) {
      result.push({ role: message.role, content: contentOf(message) })
      continue
    }
    const images = await Promise.all(
      imageParts.map(async (part) => (await resolveImageBytes(part.hash)).toString('base64'))
    )
    result.push({ role: message.role, content: contentOf(message), images })
  }
  return result
}
