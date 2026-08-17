import type { DocumentPart } from '@shared/ipc'

// The text a document attachment contributes to the model's prompt (D17.2):
// the extraction verbatim, headed by its filename — never resummarized, since
// the chat is stateless and every turn already resends it.

/** The text a document attachment contributes to the model's prompt. */
export function formatDocumentCard(part: DocumentPart): string {
  return `[Documento anexado: ${part.fileName}]\n${part.text}`
}
