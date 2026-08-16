import type { ReactNode } from 'react'
import type { Element } from 'hast'
import { Check, Copy } from 'lucide-react'
import Markdown, { defaultUrlTransform } from 'react-markdown'
import type { Components, Options } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { checkExternalUrl } from '@core/url'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { ICON_SIZE, ICON_STROKE } from '../icon'
import styles from './MarkdownMessage.module.css'

// The model's output is untrusted input. react-markdown builds React elements,
// never an HTML string, so raw HTML is inert unless rehype-raw is added — and
// its ABSENCE is the security decision (D11.2). The rule is not "no rehype
// plugins" but "nothing that turns model text into HTML" (D12.2): rehypeHighlight
// only adds classNames to spans in an already-built tree, so it passes;
// rehype-raw does exactly what the rule forbids, so it stays out.

const rehypePlugins: Options['rehypePlugins'] = [
  // `detect: false` is the package default, written out because it IS the
  // decision (D12.5): a fence with no info string stays uncoloured, as GitHub
  // does — auto-detection guesses badly on short chat snippets. `languages` is
  // deliberately NOT narrowed, and that is measured, not preference: narrowing
  // to seven grammars built the SAME 516 modules as the default (it filters what
  // highlights, it is not a bundle lever). Real shrinking needs createLowlight.
  [rehypeHighlight, { detect: false }]
]

// Images: under CSP `img-src 'self' data:` a remote src is blocked and leaves a
// silent gap, so returning null drops the attribute and shows the alt text — a
// visible failure beats a mute one. defaultUrlTransform stays as the first layer.
function urlTransform(url: string, key: string): string | null {
  if (key === 'src') return null
  return defaultUrlTransform(url)
}

/** Walks a hast subtree back to plain text — what `copy` sends, not the `<span>`-fragmented markup rehype-highlight builds. */
function textOf(node: Element | undefined): string {
  if (node === undefined) return ''
  return node.children
    .map((child) => (child.type === 'text' ? child.value : textOf(child as Element)))
    .join('')
}

/** The fenced block's own trailing newline (before the closing ```) is part of
 * its hast text content, but not part of what a paste target wants. */
function trimTrailingNewline(text: string): string {
  return text.replace(/\n$/, '')
}

// The language label sits OUTSIDE <pre> so a selection drag over the code does
// not pick it up — the block is copyable data. The name comes off the fenced
// code's `language-*` class; absent → no label, still correct (D11.5).
function CodeBlock({
  children,
  node
}: {
  children?: ReactNode
  node?: Element
}): React.JSX.Element {
  const first = node?.children?.[0]
  const codeElement = first?.type === 'element' ? first : undefined
  const className = codeElement?.properties.className
  const language = /language-([\w-]+)/.exec(
    Array.isArray(className) ? className.join(' ') : ''
  )?.[1]
  const { copied, copy } = useCopyToClipboard()

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeBlockHeader}>
        {language !== undefined && (
          <span className={styles.lang} aria-hidden="true">
            {language}
          </span>
        )}
        <button
          type="button"
          className={styles.copyButton}
          onClick={() => void copy(trimTrailingNewline(textOf(codeElement)))}
          title={copied ? 'Copiado' : 'Copiar código'}
          aria-label={copied ? 'Copiado' : 'Copiar código'}
        >
          {copied ? (
            <Check size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
          ) : (
            <Copy size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
          )}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  )
}

const components: Components = {
  // A link renders as a clickable <a> only when checkExternalUrl approves it
  // (D11.3) — the same pure function main uses, no copy of the allow-list here.
  // Anything else renders as plain text, so no bad URL reaches the IPC schema.
  a({ href, children }) {
    if (href === undefined || !checkExternalUrl(href).ok) return <>{children}</>
    return (
      <a
        href={href}
        onClick={(event) => {
          event.preventDefault()
          void window.api.shell.openExternal(href)
        }}
      >
        {children}
      </a>
    )
  },
  pre: CodeBlock
}

// `highlight` is off for the still-streaming reply (D12.6): tokenising a growing
// block colours half a token, and an unterminated string paints the rest until
// its quote arrives. Off during the stream, everything colours at once when the
// reply lands — one transition instead of many.
function MarkdownMessage({
  text,
  highlight = true
}: {
  text: string
  highlight?: boolean
}): React.JSX.Element {
  return (
    <div className={styles.markdown}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={highlight ? rehypePlugins : undefined}
        urlTransform={urlTransform}
        components={components}
      >
        {text}
      </Markdown>
    </div>
  )
}

export default MarkdownMessage
