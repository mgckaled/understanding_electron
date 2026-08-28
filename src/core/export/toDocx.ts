import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx'
import { toBlocks, type Block, type Row, type Run } from './blocks'

/** Present on every Windows since Vista, so the file opens looking right. */
const MONO_FONT = 'Consolas'

/** Half an inch in twips — the step Word itself indents a list by. */
const INDENT = 720

const ORDERED = 'ordered'

// docx ships a styles.xml with an EMPTY <w:docDefaults> and headings carrying
// only colour and size, so Word lays everything out flush: paragraph against
// paragraph, heading against the text above it. These are Word's own Normal
// defaults, restored — layout hygiene, never the app's palette (DE1E.11).
const BODY_SPACING = { after: 160, line: 259 }
const HEADING_SPACING = { before: 280, after: 120 }
const CODE_SPACING = { before: 160, after: 160, line: 240 }

const DEFAULT_STYLES = {
  document: { paragraph: { spacing: BODY_SPACING } },
  heading1: { paragraph: { spacing: { before: 360, after: 160 } } },
  heading2: { paragraph: { spacing: HEADING_SPACING } },
  heading3: { paragraph: { spacing: HEADING_SPACING } },
  heading4: { paragraph: { spacing: HEADING_SPACING } },
  heading5: { paragraph: { spacing: HEADING_SPACING } },
  heading6: { paragraph: { spacing: HEADING_SPACING } },
  // Without contextualSpacing every bullet would take the full paragraph gap,
  // and a list would read as a pile of separate paragraphs.
  listParagraph: { paragraph: { spacing: { after: 60 }, contextualSpacing: true } }
}

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

// A real Word table, not text with tabs: Word's tab stops are fixed, so a
// tabbed row ragged-aligns the moment one cell is longer than the stop (DE1E.10).
function tableOf(rows: readonly Row[]): Table {
  const width = { size: 100, type: WidthType.PERCENTAGE }

  return new Table({
    width,
    rows: rows.map(
      (cells, index) =>
        new TableRow({
          // Repeats the header when the table crosses a page.
          tableHeader: index === 0 ? true : undefined,
          children: cells.map(
            (runs) =>
              new TableCell({
                width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: runs.map(textRun) })]
              })
          )
        })
    )
  })
}

function elementOf(block: Block): Paragraph | Table {
  const children = block.runs.map(textRun)

  switch (block.kind) {
    case 'table':
      return tableOf(block.rows ?? [])
    case 'rule':
      return new Paragraph({ thematicBreak: true })
    case 'heading':
      return new Paragraph({ children, heading: HEADINGS[Math.min(block.level ?? 1, 6) - 1] })
    case 'code':
      return new Paragraph({ children, indent: { left: INDENT }, spacing: CODE_SPACING })
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
    styles: { default: DEFAULT_STYLES },
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
    sections: [{ children: toBlocks(markdown).map(elementOf) }]
  })

  return Packer.toBuffer(document)
}
