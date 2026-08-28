import { useMemo } from 'react'
import { resolveLanguage } from '@core/draft/languages'
import { tokenize } from './codeHighlight'

// Code previews as the file it will become, never through the markdown
// renderer: markdown joins consecutive lines into a paragraph and reads four
// leading spaces as a code block (DE2A.9). `whitespace-pre` keeps every space.
const PRE =
  'min-h-[0px] flex-1 overflow-auto p-7 font-mono text-sm whitespace-pre text-text selectable'

/**
 * The draft's code, coloured by the same highlighter the editor uses.
 *
 * @param language - The stored fence language, or `null`; an unknown one falls
 *   back to plain text rather than to a guess (DE2B.4).
 */
function CodePreview({
  code,
  language
}: {
  code: string
  language: string | null
}): React.JSX.Element {
  const lines = useMemo(() => tokenize(code, resolveLanguage(language)?.id), [code, language])

  if (lines === null) return <pre className={PRE}>{code}</pre>

  return (
    <pre className={PRE}>
      {lines.map((tokens, line) => (
        // Index keys: the list is rebuilt whole on every edit, never reordered.
        <span key={line}>
          {tokens.map((token, index) => (
            <span key={index} className={token.classes === '' ? undefined : token.classes}>
              {token.text}
            </span>
          ))}
          {line < lines.length - 1 && '\n'}
        </span>
      ))}
    </pre>
  )
}

export default CodePreview
