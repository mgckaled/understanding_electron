import type { AttachmentPart, ChatMessage, Message, MessagePart } from '@shared/ipc'
import { formatDataCard } from './dataCard'
import { formatDocumentCard } from './documentCard'

// Message is a list of typed parts; a provider wants flat `{ role, content }`.
// The translation lives in core/, not the renderer, because plano 16 hangs the
// three-level privacy boundary here — a decision two callers need belongs in
// core/, or validation next to one becomes a bypass in the second.

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
  }
}

/** The conversation as the provider sees it. */
export function toChatMessages(messages: Message[]): ChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.parts.map(partForProvider).join('\n\n')
  }))
}
