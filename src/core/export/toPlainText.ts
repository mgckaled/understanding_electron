import { toBlocks, type Block } from './blocks'

/** A rule has no runs, and vanishing silently is the defect this file exists to end. */
const RULE = '---'

function lineOf(block: Block): string {
  if (block.kind === 'rule') return RULE
  return block.runs.map((run) => (run.newLine === true ? `\n${run.text}` : run.text)).join('')
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
