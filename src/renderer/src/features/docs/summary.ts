import type { DocsPart } from '@shared/ipc'

// One owner for how a consultation is summarised, because the transcript line
// and the history row sit a palm apart: the bare `5 · 1.637 tok` the history
// first shipped read as "five what?" beside the line's `5 trechos`.

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/** What a consultation still costs the next turn — snippets and notes, never `rules` (DM-17). */
export function costOf(part: DocsPart): number {
  return [...part.snippets, ...part.notes].reduce((sum, one) => sum + one.tokens, 0)
}

/** What a consultation carries, in words: `5 trechos · 2 notas`, notes omitted when none. */
export function countsOf(part: DocsPart): string {
  return [
    plural(part.snippets.length, 'trecho', 'trechos'),
    ...(part.notes.length === 0 ? [] : [plural(part.notes.length, 'nota', 'notas')])
  ].join(' · ')
}
