import { toBlocks, type Block, type Run } from './blocks'

/** A rule has no runs, and vanishing silently is the defect this file exists to end. */
const RULE = '---'

/** Between cells of a flattened table — the plain-text convention for tabular data. */
const CELL_SEPARATOR = '\t'

function textOf(runs: readonly Run[]): string {
  return runs.map((run) => (run.newLine === true ? `\n${run.text}` : run.text)).join('')
}

function lineOf(block: Block): string {
  if (block.kind === 'rule') return RULE
  if (block.kind === 'table') {
    return (block.rows ?? []).map((row) => row.map(textOf).join(CELL_SEPARATOR)).join('\n')
  }
  return textOf(block.runs)
}

/**
 * The draft's text with the markdown syntax removed, for `.txt`.
 *
 * Built from the same blocks the `.docx` draws, and never serialised back
 * through remark: a stringifier escapes what could read as markup and turns
 * leading spaces into `&#x20;`, which mangles source code (DE1E.9).
 *
 * @param markdown - The draft as written.
 */
export function toPlainText(markdown: string): string {
  const blocks = toBlocks(markdown)
  return blocks.length === 0 ? '' : `${blocks.map(lineOf).join('\n\n')}\n`
}
