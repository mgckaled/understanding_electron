import type { ChatMessage, Message } from '@shared/ipc'

/*
 * The application's Message is a list of typed parts; a provider wants a flat
 * `{ role, content }`. The translation between them is a pure function, and it
 * lives here rather than in the renderer for a reason that is not tidiness:
 * this is where plano 16 hangs the three-level privacy boundary (schema ·
 * aggregate profile · row sample). A dataset part must decide what it is
 * allowed to say to a cloud provider, and a decision two callers need is a
 * decision that belongs in core/ — validation placed next to one of them
 * becomes a bypass in the second (docs/HISTORY.md § armadilhas).
 *
 * Today only 'text' exists, so the function is short. The place is the point.
 */

/** All the text a message carries, in order. Non-text parts contribute nothing. */
export function messageText(message: Message): string {
  return message.parts
    .filter((part) => part.kind === 'text')
    .map((part) => part.text)
    .join('')
}

/** The conversation as the provider sees it. */
export function toChatMessages(messages: Message[]): ChatMessage[] {
  return messages.map((message) => ({ role: message.role, content: messageText(message) }))
}
