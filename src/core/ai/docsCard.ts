import type { DocsPart } from '@shared/ipc'

// The text one Context7 consultation contributes to the model's prompt. Same
// shape as formatDocumentCard (D17.2): verbatim, never resummarized, since the
// chat is stateless and resends the transcript every turn. What must not repeat
// is the paid call, not the resend.
//
// `omitted` never appears here, and neither do `rules`: the first is the record
// of what the user left out (D23C.3), the second is a third party's instruction
// aimed at the model (DM-17). Both are shown on screen and never sent.

/** The text one Context7 consultation contributes to the model's prompt. */
export function formatDocsCard(part: DocsPart): string {
  const version = part.version === null ? '' : ` ${part.version}`
  const header = `[Documentação consultada: ${part.libraryId}${version} — "${part.query}"]`

  const snippets = part.snippets.map((snippet) => {
    const blocks = snippet.blocks.map((block) => `\`\`\`${block.language}\n${block.code}\n\`\`\``)
    return [snippet.title, ...blocks].join('\n')
  })

  const notes = part.notes.map((note) =>
    note.breadcrumb === null ? note.content : `${note.breadcrumb}\n${note.content}`
  )

  return [header, ...snippets, ...notes].join('\n\n')
}
