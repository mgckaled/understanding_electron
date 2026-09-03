import type {
  AiService,
  AttachmentPart,
  ChatMessage,
  ImagePart,
  Message,
  MessagePart,
  ReasoningPart,
  StepProposalPart
} from '@shared/ipc'
import { describeSteps } from '../pipeline/describe'
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
  return (
    message.parts.find(
      (part): part is AttachmentPart =>
        part.kind !== 'text' && part.kind !== 'stepProposal' && part.kind !== 'reasoning'
    ) ?? null
  )
}

/** The reasoning trace on a message, if any (arco 21) — never more than one per turn. */
export function reasoningPartOf(message: Message): ReasoningPart | null {
  return message.parts.find((part): part is ReasoningPart => part.kind === 'reasoning') ?? null
}

/**
 * Every attachment in the transcript, oldest first (DF3B.2).
 *
 * Derived from {@link attachmentPartOf} rather than re-scanning parts, so
 * "what counts as an attachment" is decided in one place. A file attached
 * twice appears twice: these are cards on screen, not distinct files.
 */
export function attachmentPartsOf(messages: Message[]): AttachmentPart[] {
  return messages.map(attachmentPartOf).filter((part): part is AttachmentPart => part !== null)
}

/** The step proposal on an assistant message, if any (plano 19) — the card ConversationView swaps in for the plain text bubble. */
export function stepProposalPartOf(message: Message): StepProposalPart | null {
  return (
    message.parts.find((part): part is StepProposalPart => part.kind === 'stepProposal') ?? null
  )
}

/** How many image parts a turn carries — the flat token cost the budget adds is this times `IMAGE_TOKEN_ESTIMATE` (D17.12). */
export function imageCountOf(messages: Message[]): number {
  return messages.reduce(
    (total, message) => total + message.parts.filter((part) => part.kind === 'image').length,
    0
  )
}

/**
 * Rebuilds the "ancoramento pós-fato" (21-C) anchor from an already loaded
 * transcript — opening a conversation (or restarting the app) must not fall
 * back to re-deriving the whole history through the ratio, the exact "linear"
 * drift the anchor exists to avoid. Walks back to the last assistant message
 * carrying a real `promptTokens` and measures the prefix it was sent with,
 * the same slice `send` measures live. `undefined` when no turn in this
 * transcript has one yet (messages written before the v5 column, or a
 * provider that reports no counters).
 */
export function anchorFromHistory(
  messages: Message[]
): { tokens: number; chars: number; imageCount: number } | undefined {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (message.role === 'assistant' && message.promptTokens !== undefined) {
      const prefix = messages.slice(0, index)
      const chars = toChatMessages(prefix).reduce(
        (total, chatMessage) => total + chatMessage.content.length,
        0
      )
      return { tokens: message.promptTokens, chars, imageCount: imageCountOf(prefix) }
    }
  }
  return undefined
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
    case 'stepProposal':
      // The transcript is resent whole every turn (stateless provider) — a
      // proposal from an earlier turn needs a textual form here too, or the
      // model loses track of what it already proposed.
      return `[Proposta de passos]\n${describeSteps(part.steps)}`
    case 'reasoning':
      // Never resent (D21A.3) — same treatment as image: the final content
      // already captures what matters, and resending would only inflate
      // historyChars for no benefit.
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
