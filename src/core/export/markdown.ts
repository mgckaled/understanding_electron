import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import type { Root } from 'mdast'

const parser = remark().use(remarkGfm)

/**
 * Parses `markdown` into its syntax tree, in the one dialect the app reads.
 *
 * @param markdown - The draft as written.
 */
export function parseMarkdown(markdown: string): Root {
  return parser.parse(markdown)
}
