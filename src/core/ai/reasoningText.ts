import type { PhrasingContent, RootContent, Table } from 'mdast'
import { parseMarkdown } from '../export/markdown'

// Renderer-only: an import from main/ would drag remark into the CJS main
// bundle and reopen the ESM-only trap fixed in DE1D.9.

function phrasingText(nodes: readonly PhrasingContent[]): string {
  return nodes
    .map((node): string => {
      switch (node.type) {
        case 'text':
        case 'inlineCode':
        case 'html':
          return node.value
        case 'break':
          return ' '
        case 'image':
          return node.alt ?? ''
        case 'imageReference':
          return node.alt ?? node.label ?? ''
        default:
          return 'children' in node ? phrasingText(node.children) : ''
      }
    })
    .join('')
}

function tableText(node: Table): string {
  return node.children
    .map((row) => row.children.map((cell) => phrasingText(cell.children)).join(' '))
    .join(' ')
}

function blockText(nodes: readonly RootContent[]): string {
  return nodes
    .map((node): string => {
      switch (node.type) {
        case 'heading':
        case 'paragraph':
          return phrasingText(node.children)
        case 'code':
        case 'html':
          return node.value
        case 'thematicBreak':
          return ''
        case 'table':
          return tableText(node)
        default:
          return 'children' in node ? blockText(node.children) : ''
      }
    })
    .join(' ')
}

/**
 * Reasoning trace flattened to running prose — never re-serialized to
 * markdown (DE1E.9), so nothing is escaped and no code/table content drops.
 *
 * @param text - Raw markdown a model produced while reasoning.
 * @returns One paragraph, no markup.
 */
export function flattenReasoning(text: string): string {
  if (text.trim() === '') return ''
  return blockText(parseMarkdown(text).children).replace(/\s+/g, ' ').trim()
}
