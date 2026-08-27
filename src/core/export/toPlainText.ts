import { remark } from 'remark'
import strip from 'strip-markdown'

// `strip-markdown` and not `mdast-util-to-string`: the first keeps paragraphs,
// the second flattens the whole document into one line (DE1D.6).
const processor = remark().use(strip)

/**
 * The draft's text with the markdown syntax removed, for `.txt`.
 *
 * @param markdown - The draft as written.
 */
export function toPlainText(markdown: string): string {
  // processSync only holds while every plugin here is synchronous; an async one
  // added later throws instead of degrading.
  return String(processor.processSync(markdown))
}
