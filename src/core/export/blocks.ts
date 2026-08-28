import type { PhrasingContent, RootContent, Table } from 'mdast'
import { parseMarkdown } from './markdown'

export type Run = {
  text: string
  bold?: true
  italic?: true
  strike?: true
  mono?: true
  /** A line break precedes this run's text, inside the same block. */
  newLine?: true
}

export type Cell = Run[]
export type Row = Cell[]

export type Block = {
  kind: 'paragraph' | 'heading' | 'quote' | 'code' | 'rule' | 'table'
  runs: Run[]
  /** 1 to 6, only on a `heading`. */
  level?: number
  list?: { ordered: boolean; level: number }
  /** Only on a `table`, and always rectangular. `runs` stays empty there. */
  rows?: Row[]
}

// Markdown nests without a limit and Word does not: the levels have to be
// declared up front, so anything deeper is pinned to the last one (DE1E.4).
const MAX_LIST_LEVEL = 4

type Context = { quote?: true; list?: { ordered: boolean; level: number } }

function runsOf(nodes: readonly PhrasingContent[], style: Omit<Run, 'text'> = {}): Run[] {
  return nodes.flatMap((node): Run[] => {
    switch (node.type) {
      case 'text':
        return [{ ...style, text: node.value }]
      case 'inlineCode':
        return [{ ...style, text: node.value, mono: true }]
      case 'strong':
        return runsOf(node.children, { ...style, bold: true })
      case 'emphasis':
        return runsOf(node.children, { ...style, italic: true })
      case 'delete':
        return runsOf(node.children, { ...style, strike: true })
      case 'break':
        return [{ ...style, text: '', newLine: true }]
      case 'image':
        return [{ ...style, text: node.alt ?? '' }]
      case 'imageReference':
        return [{ ...style, text: node.alt ?? node.label ?? '' }]
      default:
        // Never lose text: an unmapped node gives up its children, or its own
        // value, rather than disappearing (DE1E.7).
        return 'children' in node ? runsOf(node.children, style) : []
    }
  })
}

function codeBlock(value: string): Block {
  return {
    kind: 'code',
    runs: value.split('\n').map((line, index) => ({
      text: line,
      mono: true,
      ...(index === 0 ? {} : { newLine: true as const })
    }))
  }
}

function tableBlock(node: Table): Block {
  const rows = node.children.map((row, index) =>
    row.children.map((cell) => runsOf(cell.children, index === 0 ? { bold: true } : {}))
  )
  // Rectangular even when the markdown is not: a short row would leave Word
  // drawing a ragged table, and both renderers would have to guard separately.
  const width = Math.max(0, ...rows.map((row) => row.length))

  return {
    kind: 'table',
    runs: [],
    rows: rows.map((row) => [...row, ...Array.from({ length: width - row.length }, (): Cell => [])])
  }
}

function blocksOf(nodes: readonly RootContent[], context: Context): Block[] {
  return nodes.flatMap((node): Block[] => {
    switch (node.type) {
      case 'heading':
        return [{ kind: 'heading', level: node.depth, runs: runsOf(node.children) }]
      case 'paragraph':
        return [
          {
            kind: context.quote === true ? 'quote' : 'paragraph',
            runs: runsOf(node.children),
            ...(context.list === undefined ? {} : { list: context.list })
          }
        ]
      case 'code':
        return [codeBlock(node.value)]
      case 'thematicBreak':
        return [{ kind: 'rule', runs: [] }]
      case 'blockquote':
        return blocksOf(node.children, { ...context, quote: true })
      case 'list':
        return blocksOf(node.children, {
          ...context,
          list: {
            ordered: node.ordered === true,
            level: Math.min(context.list === undefined ? 0 : context.list.level + 1, MAX_LIST_LEVEL)
          }
        })
      case 'listItem':
        return blocksOf(node.children, context)
      case 'table':
        return [tableBlock(node)]
      case 'html':
        return [{ kind: 'paragraph', runs: [{ text: node.value }] }]
      default:
        return 'children' in node ? blocksOf(node.children, context) : []
    }
  })
}

function hasContent(block: Block): boolean {
  if (block.kind === 'rule') return true
  if (block.kind === 'table') return block.rows !== undefined && block.rows.length > 0
  return block.runs.length > 0
}

/**
 * Turns `markdown` into the blocks an exporter draws, one decision per node.
 *
 * @param markdown - The draft as written.
 * @returns Blocks in reading order, the empty ones dropped — except a rule and
 *   a table, which carry their content somewhere other than `runs`.
 */
export function toBlocks(markdown: string): Block[] {
  return blocksOf(parseMarkdown(markdown).children, {}).filter(hasContent)
}
