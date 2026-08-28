import { toBlocks, type Block, type Cell, type Run } from './blocks'

// Print colours, deliberately not the app's tokens: this document leaves the
// app and is read on paper or in a viewer, where black on white is the point
// (DE1F.5). `pre-wrap` keeps a long source line inside the page instead of
// cutting it at the margin.
const STYLE = `
@page { size: A4; margin: 2cm }
body { font: 11pt/1.5 system-ui, sans-serif; color: #000; background: #fff; margin: 0 }
h1, h2, h3, h4, h5, h6 { break-after: avoid; line-height: 1.25 }
p, li { orphans: 2; widows: 2 }
pre { font-family: ui-monospace, Consolas, monospace; font-size: 10pt; background: #f4f4f5;
      padding: 10px; break-inside: avoid; white-space: pre-wrap; margin: 1em 0 }
code { font-family: ui-monospace, Consolas, monospace; font-size: .92em }
blockquote { margin: 1em 0 1em 1.5em; font-style: italic; color: #333 }
hr { border: none; border-top: 1px solid #999; margin: 1.5em 0 }
table { width: 100%; border-collapse: collapse; margin: 1em 0 }
thead { display: table-header-group }
tr { break-inside: avoid }
th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; vertical-align: top }`

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
}

/** Every run goes through here: what enters is model text, what leaves is our tags (DE1F.3). */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => ESCAPES[char])
}

function runHtml(run: Run): string {
  let html = escapeHtml(run.text)
  if (run.mono === true) html = `<code>${html}</code>`
  if (run.strike === true) html = `<s>${html}</s>`
  if (run.italic === true) html = `<em>${html}</em>`
  if (run.bold === true) html = `<strong>${html}</strong>`
  return run.newLine === true ? `<br>${html}` : html
}

function inline(runs: readonly Run[]): string {
  return runs.map(runHtml).join('')
}

/** Inside `<pre>` a break is a real newline, not a `<br>`, or the source stops being copyable. */
function codeHtml(runs: readonly Run[]): string {
  const text = runs.map((run) => (run.newLine === true ? `\n${run.text}` : run.text)).join('')
  return `<pre><code>${escapeHtml(text)}</code></pre>`
}

function cellsHtml(cells: readonly Cell[], tag: 'th' | 'td'): string {
  return cells.map((cell) => `<${tag}>${inline(cell)}</${tag}>`).join('')
}

function tableHtml(rows: readonly Cell[][]): string {
  const [header, ...body] = rows
  const head = header === undefined ? '' : `<thead><tr>${cellsHtml(header, 'th')}</tr></thead>`
  const rest = body.map((row) => `<tr>${cellsHtml(row, 'td')}</tr>`).join('')
  return `<table>${head}<tbody>${rest}</tbody></table>`
}

function blockHtml(block: Block): string {
  switch (block.kind) {
    case 'rule':
      return '<hr>'
    case 'heading': {
      const level = Math.min(block.level ?? 1, 6)
      return `<h${level}>${inline(block.runs)}</h${level}>`
    }
    case 'code':
      return codeHtml(block.runs)
    case 'quote':
      return `<blockquote><p>${inline(block.runs)}</p></blockquote>`
    case 'table':
      return tableHtml(block.rows ?? [])
    default:
      return `<p>${inline(block.runs)}</p>`
  }
}

/**
 * Walks the blocks emitting real `<ul>`/`<ol>` nesting, so the browser draws
 * the markers and the indentation instead of this file faking them. The stack
 * holds one entry per open level; `list.level` says how deep the item belongs.
 */
function bodyHtml(blocks: readonly Block[]): string {
  const open: boolean[] = []
  const out: string[] = []

  const closeTo = (depth: number): void => {
    while (open.length > depth) out.push(open.pop() === true ? '</ol>' : '</ul>')
  }

  for (const block of blocks) {
    if (block.list === undefined) {
      closeTo(0)
      out.push(blockHtml(block))
      continue
    }

    const { ordered, level } = block.list
    closeTo(level + 1)
    // A bullet list turning into a numbered one at the same depth is a new
    // list, not a continuation.
    if (open.length === level + 1 && open[level] !== ordered) {
      closeTo(level)
    }
    while (open.length < level + 1) {
      open.push(ordered)
      out.push(ordered ? '<ol>' : '<ul>')
    }
    out.push(`<li>${inline(block.runs)}</li>`)
  }

  closeTo(0)
  return out.join('')
}

/**
 * Renders `markdown` as a self-contained HTML document, for `printToPDF`.
 *
 * The document declares `default-src 'none'`: escaping every run is what keeps
 * model text from becoming markup, and the policy is the second lock behind it
 * (DE1F.3).
 *
 * @param markdown - The draft as written.
 */
export function toHtml(markdown: string): string {
  return (
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'">` +
    `<style>${STYLE}</style></head><body>${bodyHtml(toBlocks(markdown))}</body></html>`
  )
}
