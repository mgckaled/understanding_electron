import { useId, useMemo, useState } from 'react'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { resolveLanguage } from '@core/draft/languages'
import type { DocCodeBlock, DocSnippet } from '@shared/ipc'
import Button from '../../shared/ui/Button/Button'
import MarkdownMessage from '../../shared/ui/MarkdownMessage/MarkdownMessage'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { cx } from '../../shared/ui/cx'
import { tokenize } from '../draft/codeHighlight'

const decimal = new Intl.NumberFormat('pt-BR')

const PRE =
  'overflow-x-auto rounded-md bg-surface-sunken p-4 font-mono text-md whitespace-pre selectable'

/**
 * One example, coloured by the same highlighter the draft editor uses (D23F.12).
 * `resolveLanguage` already lowercases, so the API's `TypeScript` matches and
 * its `APIDOC` falls back to plain text instead of guessing.
 */
function CodeBlock({ block }: { block: DocCodeBlock }): React.JSX.Element {
  const lines = useMemo(
    () => tokenize(block.code, resolveLanguage(block.language)?.id),
    [block.code, block.language]
  )

  if (lines === null) return <pre className={`${PRE} text-text`}>{block.code}</pre>

  return (
    <pre className={`${PRE} text-text`}>
      {lines.map((tokens, line) => (
        // Index keys: the list is rebuilt whole, never reordered.
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

function Snippet({
  snippet,
  open: initial
}: {
  snippet: DocSnippet
  open: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(initial)
  const bodyId = useId()
  const source = snippet.sourceUrl

  // The variants of one example, deduplicated: an example without types comes
  // back identical in TypeScript and JavaScript, and drawing both would render
  // the same code twice (D23F.11, D23B.11).
  const blocks = useMemo(
    () => snippet.blocks.filter((one, at, all) => all.findIndex((x) => x.code === one.code) === at),
    [snippet.blocks]
  )

  return (
    <div className="flex flex-col gap-2">
      {/* Siblings, never nested: a button inside a button is invalid HTML and
          React does not warn (painel.md). */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-[0px] flex-1 cursor-pointer items-baseline gap-2 text-left"
        >
          <ChevronDown
            size={ICON_SIZE.sm}
            strokeWidth={ICON_STROKE}
            className={cx(
              'flex-none self-center text-text-faint',
              'transition-transform duration-(--duration-fast) ease-initial',
              !open && '-rotate-90'
            )}
          />
          <span className="truncate font-ui text-sm text-text">{snippet.title}</span>
          <span className="ml-auto flex-none text-xs text-text-faint">
            {decimal.format(snippet.tokens)} tok
          </span>
        </button>
        {/* Absent, not disabled, when the codeId did not parse as a URL — it
            has two real formats, and one of them is not a link (D23F.10). */}
        {source !== null && (
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            className="flex-none"
            aria-label={`Abrir a fonte de ${snippet.title}`}
            onClick={() => void window.api.shell.openExternal(source)}
          >
            <ExternalLink size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
          </Button>
        )}
      </div>

      <div
        id={bodyId}
        aria-hidden={!open}
        // h-0 emits no CSS at all — --spacing-* is only defined for 1-9.
        className={cx('overflow-hidden', open ? '[height:calc-size(auto,size)]' : 'h-[0px]')}
      >
        <div className="flex flex-col gap-3 pb-2">
          {/* Through the app's markdown owner, not raw: the API writes inline
              code with backticks, and they showed as literal characters. The
              deciding argument is not the backticks though — the description is
              third-party text, the same threat model D11.2 answered, so it gets
              the renderer that already refuses raw HTML and vets every link. */}
          {snippet.description !== '' && <MarkdownMessage text={snippet.description} />}
          {blocks.map((block) => (
            <CodeBlock key={block.code} block={block} />
          ))}
        </div>
      </div>
    </div>
  )
}

/** The Trechos tab: one disclosure per snippet, the first already open (D23F.9). */
function DocsSnippetList({ snippets }: { snippets: DocSnippet[] }): React.JSX.Element {
  if (snippets.length === 0) {
    return (
      <p className="p-5 text-xs text-text-muted">Nenhum trecho de código para esta pergunta.</p>
    )
  }

  return (
    <div className="flex min-h-[0px] flex-1 flex-col gap-4 overflow-y-auto p-5">
      {snippets.map((snippet, at) => (
        <Snippet key={snippet.key} snippet={snippet} open={at === 0} />
      ))}
    </div>
  )
}

export default DocsSnippetList
