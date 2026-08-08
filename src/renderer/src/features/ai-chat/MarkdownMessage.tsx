import Markdown, { defaultUrlTransform } from 'react-markdown'
import type { Components, Options } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { checkExternalUrl } from '@core/url'
import styles from './MarkdownMessage.module.css'

/*
 * The model's output is untrusted input — the first time external text becomes
 * DOM in this app. react-markdown builds React elements, never an HTML string,
 * so there is no dangerouslySetInnerHTML, and raw HTML is ignored unless
 * rehype-raw is added on purpose. That plugin does NOT enter: the absence is the
 * security decision (D11.2).
 *
 * The rule is NOT "no rehype plugins" — it is "nothing that turns the model's
 * text into HTML" (D12.2). rehypeHighlight below passes that rule: it walks the
 * hast tree react-markdown has already built and adds a className to spans
 * inside <code>. It never parses HTML and never builds a node out of model text.
 * rehype-raw does exactly what the rule forbids, so it stays out — including the
 * day someone wants to "make some HTML work".
 */

const rehypePlugins: Options['rehypePlugins'] = [
  // `detect: false` is already the package default, and is written out because
  // it IS the decision (D12.5): a fence with no info string stays uncoloured,
  // which is what GitHub does. Auto-detection guesses badly on the short
  // snippets a chat reply is made of, and a default left unwritten is a default
  // nobody defends when a later reader wonders why blocks look inconsistent.
  //
  // `languages` is deliberately NOT narrowed, and that is a measurement, not a
  // preference: restricting it to the seven grammars this app expects built to
  // 1.301,28 kB against 1.301,17 kB for the default `common` — the same 516
  // modules. rehype-highlight imports `common` from lowlight at module scope
  // (lib/index.js:30), so all 37 grammars land in the bundle whether the option
  // is passed or not. It filters what gets highlighted; it is not a bundle
  // lever. Seven imports to gain 0,11 kB and lose thirty languages is a bad
  // trade. Shrinking this for real means a small plugin over `createLowlight`.
  [rehypeHighlight, { detect: false }]
]

// Images: the CSP is `img-src 'self' data:`, so a remote ![](https://…) is blocked
// by Chromium and leaves a silent gap. Returning null for the src drops the
// attribute and lets the alt text show instead — a visible failure beats a mute
// one. defaultUrlTransform stays as the first layer (it blocks `javascript:`).
function urlTransform(url: string, key: string): string | null {
  if (key === 'src') return null
  return defaultUrlTransform(url)
}

const components: Components = {
  // A link renders as a clickable <a> only when checkExternalUrl — the same pure
  // function main uses — approves it (D11.3). Anything else (relative, bad scheme)
  // renders as plain text, so no malformed URL reaches the IPC contract, whose
  // schema would throw on it. No copy of the allow-list lives here.
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
  // The language label sits OUTSIDE <pre> so a selection drag over the code does
  // not pick it up — the block is copyable data. The name comes off the fenced
  // code's `language-*` class; absent → no label, still correct (D11.5).
  pre({ children, node }) {
    const first = node?.children?.[0]
    const className = first?.type === 'element' ? first.properties.className : undefined
    const language = /language-([\w-]+)/.exec(
      Array.isArray(className) ? className.join(' ') : ''
    )?.[1]
    return (
      <div className={styles.codeBlock}>
        {language !== undefined && (
          <span className={styles.lang} aria-hidden="true">
            {language}
          </span>
        )}
        <pre>{children}</pre>
      </div>
    )
  }
}

// `highlight` is off for the still-streaming reply (D12.6). Tokenising a block
// that is still growing colours half a token, then corrects itself — an
// unterminated string literal paints the rest of the block as string until the
// closing quote arrives. Off during the stream, everything colours at once when
// the reply lands, which reads as one transition instead of many.
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
