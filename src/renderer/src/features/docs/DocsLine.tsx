import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { noteTitle } from '@core/context7/part'
import type { DocsPart } from '@shared/ipc'
import Switch from '../../shared/ui/Switch/Switch'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { cx } from '../../shared/ui/cx'
import { useConversations } from '../conversation/conversationsContext'
import { DocsIcon } from './icon'

const decimal = new Intl.NumberFormat('pt-BR')

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * One Context7 consultation, as a disclosure line in the transcript (DM-23).
 *
 * The body lists titles and cost and never the code: the code belongs to the
 * panel, and this answers "what was sent, and what did it cost" (D23C.3). The
 * switch, the collapse button and the label are SIBLINGS in a flex row — an
 * interactive element nested inside a `role="button"` loses its semantics, and
 * React does not warn (D23H.3).
 *
 * @param messageId - Which message the toggle addresses; the part's own id
 *   scopes the UPDATE inside it.
 */
function DocsLine({ part, messageId }: { part: DocsPart; messageId: string }): React.JSX.Element {
  const bodyId = useId()
  const [open, setOpen] = useState(false)
  const { activeId, setDocsEnabled } = useConversations()

  const sent = [...part.snippets, ...part.notes]
  const tokens = sent.reduce((sum, one) => sum + one.tokens, 0)
  const counts = [
    plural(part.snippets.length, 'trecho', 'trechos'),
    ...(part.notes.length === 0 ? [] : [plural(part.notes.length, 'nota', 'notas')])
  ].join(' · ')

  return (
    <div className="mb-1 max-w-[80%] rounded-lg border border-border bg-surface-raised px-5 py-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-[0px] flex-1 items-center gap-2 font-ui text-sm text-text-muted"
        >
          <DocsIcon size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} className="flex-none" />
          {/* "Context7" as text is the credit DM-32 kept out of the icon. */}
          <span className="truncate">Context7 · {part.libraryId}</span>
          <span className="ml-auto flex-none text-text-faint">
            {counts} · ~{decimal.format(tokens)} tok
          </span>
          <ChevronDown
            size={ICON_SIZE.sm}
            strokeWidth={ICON_STROKE}
            className={cx(
              'flex-none transition-transform duration-(--duration-fast) ease-initial',
              open && 'rotate-180'
            )}
          />
        </button>
        <Switch
          checked={part.enabled}
          // The conversation is always resolved here: the line only renders
          // inside a transcript that is on screen.
          onChange={(next) => setDocsEnabled(activeId as string, messageId, part.id, next)}
          aria-label={`${part.enabled ? 'Tirar' : 'Devolver'} esta consulta do contexto`}
          className="flex-none"
        />
      </div>

      {/* Without this the switch is invisible where it matters most (DM-31). */}
      {!part.enabled && <p className="mt-2 text-2xs text-warn-text">fora do contexto</p>}

      <div
        id={bodyId}
        aria-hidden={!open}
        className={cx(
          'overflow-hidden',
          // h-0 emits no CSS: --spacing-* is only defined for 1-9.
          open ? '[height:calc-size(auto,size)]' : 'h-[0px]'
        )}
      >
        <p className="mt-3 text-sm text-text-muted italic select-text">“{part.query}”</p>
        <ul className="mt-2 flex flex-col gap-1 text-xs">
          {part.snippets.map((snippet) => (
            <li key={snippet.key} className="flex items-baseline gap-3">
              <span className="truncate text-text-muted">{snippet.title}</span>
              <span className="ml-auto flex-none text-text-faint">
                {decimal.format(snippet.tokens)} tok
              </span>
            </li>
          ))}
          {part.notes.map((note) => (
            <li key={note.key} className="flex items-baseline gap-3">
              <span className="truncate text-text-muted">{noteTitle(note)}</span>
              <span className="ml-auto flex-none text-text-faint">
                {decimal.format(note.tokens)} tok
              </span>
            </li>
          ))}
          {/* The record of what the user left out, title and cost alone — the
              part never kept its code (D23C.3). */}
          {part.omitted.map((one) => (
            <li key={one.key} className="flex items-baseline gap-3 line-through">
              <span className="truncate text-text-faint">{one.title}</span>
              <span className="ml-auto flex-none text-text-faint">— não enviado</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default DocsLine
