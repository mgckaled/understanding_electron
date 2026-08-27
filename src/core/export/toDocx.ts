import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun
} from 'docx'
import { toBlocks, type Block, type Run } from './blocks'

/** Present on every Windows since Vista, so the file opens looking right. */
const MONO_FONT = 'Consolas'

/** Half an inch in twips — the step Word itself indents a list by. */
const INDENT = 720

const ORDERED = 'ordered'

// Word needs every level declared before a paragraph may ask for one, and the
// mapping pins nesting to the last of these (DE1E.4).
const LEVELS = [0, 1, 2, 3, 4]

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6
]

function textRun(run: Run): TextRun {
  return new TextRun({
    text: run.text,
    bold: run.bold,
    italics: run.italic,
    strike: run.strike,
    font: run.mono === true ? MONO_FONT : undefined,
    break: run.newLine === true ? 1 : undefined
  })
}

function paragraphOf(block: Block): Paragraph {
  const children = block.runs.map(textRun)

  switch (block.kind) {
    case 'rule':
      return new Paragraph({ thematicBreak: true })
    case 'heading':
      return new Paragraph({ children, heading: HEADINGS[Math.min(block.level ?? 1, 6) - 1] })
    case 'code':
      return new Paragraph({ children, indent: { left: INDENT }, spacing: { before: 0, after: 0 } })
    case 'quote':
      return new Paragraph({ children, indent: { left: INDENT }, run: { italics: true } })
    default:
      if (block.list === undefined) return new Paragraph({ children })
      return block.list.ordered
        ? new Paragraph({ children, numbering: { reference: ORDERED, level: block.list.level } })
        : new Paragraph({ children, bullet: { level: block.list.level } })
  }
}

/**
 * Renders `markdown` as the bytes of a Word document.
 *
 * Headings take Word's own built-in styles, so the reader's theme and table of
 * contents apply on their own — nothing of the app's palette travels (DE1E.8).
 *
 * @param markdown - The draft as written.
 */
export async function toDocx(markdown: string): Promise<Uint8Array> {
  const document = new Document({
    numbering: {
      config: [
        {
          reference: ORDERED,
          levels: LEVELS.map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: INDENT * (level + 1), hanging: 360 } } }
          }))
        }
      ]
    },
    sections: [{ children: toBlocks(markdown).map(paragraphOf) }]
  })

  return Packer.toBuffer(document)
}
