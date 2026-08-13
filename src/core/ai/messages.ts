import type { ChatMessage, Message } from '@shared/ipc'

// Message is a list of typed parts; a provider wants flat `{ role, content }`.
// The translation lives in core/, not the renderer, because plano 16 hangs the
// three-level privacy boundary here — a decision two callers need belongs in
// core/, or validation next to one becomes a bypass in the second. Today only
// 'text' exists, so the function is short; the place is the point.

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
