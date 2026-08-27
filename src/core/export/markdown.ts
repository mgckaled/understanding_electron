import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import strip from 'strip-markdown'
import type { Code, Paragraph, Root, Table } from 'mdast'

/** Between cells of a flattened table — the plain-text convention for tabular data. */
export const CELL_SEPARATOR = '\t'

function codeToParagraph(node: Code): Paragraph {
  return { type: 'paragraph', children: [{ type: 'text', value: node.value }] }
}

function tableToParagraphs(node: Table): Paragraph[] {
  return node.children.map((row) => ({
    type: 'paragraph',
    children: row.children.flatMap((cell, index) =>
      index === 0
        ? cell.children
        : [{ type: 'text' as const, value: CELL_SEPARATOR }, ...cell.children]
    )
  }))
}

const parser = remark().use(remarkGfm)

// `strip-markdown` and not `mdast-util-to-string`: the first keeps paragraphs,
// the second flattens the whole document into one line (DE1D.6). Its defaults
// DELETE `code` and `table`, text the user wrote — hence the replacements.
const plain = remark()
  .use(remarkGfm)
  .use(strip, {
    remove: [
      ['code', codeToParagraph],
      ['table', tableToParagraphs]
    ]
  })

/**
 * Parses `markdown` into its syntax tree, in the one dialect the app reads.
 *
 * @param markdown - The draft as written.
 */
export function parseMarkdown(markdown: string): Root {
  return parser.parse(markdown)
}

/**
 * The draft's text with the markdown syntax removed, for `.txt`.
 *
 * @param markdown - The draft as written.
 */
export function toPlainText(markdown: string): string {
  return String(plain.processSync(markdown))
}
