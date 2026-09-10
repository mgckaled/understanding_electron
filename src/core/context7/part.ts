import type { DocNote, DocsOmitted, DocsPart, DocsResult } from '@shared/ipc'

// Where the user's selection becomes the thing that persists (D23G.10). Pure,
// so what reaches the database is asserted on its own shape rather than through
// the screen that produced it.

/**
 * How a note is addressed — it has no title of its own, only the trail it sits
 * under (D23G.4). One owner, so the panel's label and the omitted record can
 * never name the same note differently.
 */
export function noteTitle(note: DocNote): string {
  return note.breadcrumb ?? 'sem trilha'
}

/**
 * Freezes one consultation into the part that goes to the transcript.
 *
 * @param offKeys - The snippets and notes left unchecked (D23G.3); each becomes
 *   an `omitted` entry carrying title and cost alone, never the code (D23C.3).
 * @returns The part, always `enabled` — turning it off is later, and belongs to
 *   the transcript rather than to the moment of attaching (DM-31).
 */
export function docsPartFrom(input: {
  id: string
  libraryId: string
  libraryTitle: string
  version: string | null
  query: string
  docs: DocsResult
  offKeys: ReadonlySet<string>
}): DocsPart {
  const { id, libraryId, libraryTitle, version, query, docs, offKeys } = input

  const omitted: DocsOmitted[] = [
    ...docs.snippets
      .filter((one) => offKeys.has(one.key))
      .map((one) => ({
        key: one.key,
        kind: 'snippet' as const,
        title: one.title,
        tokens: one.tokens
      })),
    ...docs.notes
      .filter((one) => offKeys.has(one.key))
      .map((one) => ({
        key: one.key,
        kind: 'note' as const,
        title: noteTitle(one),
        tokens: one.tokens
      }))
  ]

  return {
    kind: 'docs',
    id,
    libraryId,
    libraryTitle,
    version,
    query,
    enabled: true,
    snippets: docs.snippets.filter((one) => !offKeys.has(one.key)),
    notes: docs.notes.filter((one) => !offKeys.has(one.key)),
    omitted,
    // Kept whole even when everything else was dropped (D23C.4): it is the
    // record of what the service tried to inject, and it never materializes.
    rules: docs.rules
  }
}
