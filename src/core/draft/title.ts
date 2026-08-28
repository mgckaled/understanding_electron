import type { DraftKind } from '@shared/ipc'

/** Where a derived title is cut, in characters — a picker row, not a heading. */
const MAX_LENGTH = 60

const FALLBACK = 'Rascunho sem título'

/**
 * Labels a draft from its own first line (DE1A.4).
 *
 * Lives in core/ rather than beside the creator because E-1-C retitles on edit:
 * a copy next to one of the two would drift from the other in silence.
 *
 * @param content - The draft's text, possibly empty.
 * @param kind - Which dialect `content` is in; code keeps its marks (DE2A.4).
 * @returns The first non-empty line, cut, or a fallback label.
 */
export function draftTitle(content: string, kind: DraftKind): string {
  const line = content
    .split('\n')
    .map(kind === 'code' ? trim : strip)
    .find((candidate) => candidate !== '')

  if (line === undefined) return FALLBACK
  return line.length > MAX_LENGTH ? `${line.slice(0, MAX_LENGTH).trimEnd()}…` : line
}

// Code keeps every mark: `#`, `*` and backticks are syntax there, and the prose
// stripper turns `import * as fs` into `import  as fs` (DE2A.4).
function trim(line: string): string {
  return line.trim()
}

// Only the marks that OPEN a line, and only enough that a title does not read
// as syntax: heading hashes, quote arrows, list bullets and their numbering.
function strip(line: string): string {
  const bare = line
    .replace(/^\s*(#{1,6}(?:\s+|$)|>\s*|[-*+]\s+|\d+[.)]\s+)/, '')
    .replace(/[*_`]/g, '')
    .trim()
  // A rule line separates, it does not name — and a model answer opening with
  // one is common enough that it would title half the drafts.
  return /^[-=]+$/.test(bare) ? '' : bare
}
