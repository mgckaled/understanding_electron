import type { PhrasingContent, RootContent, Table } from 'mdast'
import { CELL_SEPARATOR, parseMarkdown } from './markdown'

export type Run = {
  text: string
  bold?: true
  italic?: true
  strike?: true
  mono?: true
  /** A line break precedes this run's text, inside the same block. */
  newLine?: true
}

export type Block = {
  kind: 'paragraph' | 'heading' | 'quote' | 'code' | 'rule'
  runs: Run[]
  /** 1 to 6, only on a `heading`. */
  level?: number
  list?: { ordered: boolean; level: number }
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

function tableBlocks(node: Table): Block[] {
  return node.children.map((row, rowIndex) => ({
    kind: 'paragraph' as const,
    runs: row.children.flatMap((cell, cellIndex) => {
      const cellRuns = runsOf(cell.children, rowIndex === 0 ? { bold: true } : {})
      return cellIndex === 0 ? cellRuns : [{ text: CELL_SEPARATOR }, ...cellRuns]
    })
  }))
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
        return tableBlocks(node)
      case 'html':
        return [{ kind: 'paragraph', runs: [{ text: node.value }] }]
      default:
        return 'children' in node ? blocksOf(node.children, context) : []
    }
  })
}

/**
 * Turns `markdown` into the blocks an exporter draws, one decision per node.
 *
 * @param markdown - The draft as written.
 * @returns Blocks in reading order; a block with no runs is dropped unless it
 *   is a rule, which carries none by definition.
 */
export function toBlocks(markdown: string): Block[] {
  return blocksOf(parseMarkdown(markdown).children, {}).filter(
    (block) => block.kind === 'rule' || block.runs.length > 0
  )
}
