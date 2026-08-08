import Markdown, { defaultUrlTransform } from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { checkExternalUrl } from '@core/url'
import styles from './MarkdownMessage.module.css'

/*
 * The model's output is untrusted input — the first time external text becomes
 * DOM in this app. react-markdown builds React elements, never an HTML string,
 * so there is no dangerouslySetInnerHTML, and raw HTML is ignored unless
 * rehype-raw is added on purpose. That plugin does NOT enter: the absence is the
 * security decision (D11.2). Do not add rehypePlugins here to "make some HTML work".
 */

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

function MarkdownMessage({ text }: { text: string }): React.JSX.Element {
  return (
    <div className={styles.markdown}>
      <Markdown remarkPlugins={[remarkGfm]} urlTransform={urlTransform} components={components}>
        {text}
      </Markdown>
    </div>
  )
}

export default MarkdownMessage
