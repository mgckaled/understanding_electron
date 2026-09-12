import { TriangleAlert } from 'lucide-react'
import { noteTitle } from '@core/context7/part'
import type { DocNote, DocRules } from '@shared/ipc'
import MarkdownMessage from '../../shared/ui/MarkdownMessage/MarkdownMessage'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'

// Split out of DocsResult.tsx in 23-H, when the re-read of an attached
// consultation became the second caller (D23H.5).

const decimal = new Intl.NumberFormat('pt-BR')

/** The scrolling body every tab of the panel shares. */
export const LIST = 'flex min-h-[0px] flex-1 flex-col gap-4 overflow-y-auto p-5'
export const EMPTY = 'p-5 text-xs text-text-muted'

// The three lists do NOT share a provenance, and saying so is the point: only
// `libraryOwn` is written by whoever publishes the library — the injection
// surface DM-17 names. The other two are the reader's own, and reach the
// response through their teamspace key (D23F.8).
const RULE_GROUPS = [
  { key: 'libraryOwn', label: 'Da biblioteca', origin: 'escritas por quem publica a biblioteca' },
  {
    key: 'libraryTeam',
    label: 'Do seu time',
    origin: 'escritas no painel do Context7, sob a sua chave'
  },
  {
    key: 'global',
    label: 'Globais',
    origin: 'escritas no painel do Context7, valem para toda consulta'
  }
] as const

/**
 * The notes of one response, each with the checkbox that decides whether it is
 * sent.
 *
 * @param frozen - Attached consultations are read-only (D23G.7).
 */
export function NoteList({
  notes,
  isOn,
  onToggle,
  frozen
}: {
  notes: DocNote[]
  isOn: (key: string) => boolean
  onToggle: (key: string) => void
  frozen: boolean
}): React.JSX.Element {
  // The common case, not the edge: infoSnippets came back empty in 3 of 4
  // `fast=false` responses (api.md).
  if (notes.length === 0) {
    return <p className={EMPTY}>Esta resposta não trouxe nota — só código.</p>
  }

  return (
    <div role="group" aria-label="Notas a enviar" className={LIST}>
      {notes.map((note) => {
        const on = isOn(note.key)
        return (
          <div key={note.key} className="flex flex-col gap-1">
            <span className="flex items-baseline gap-3 text-xs">
              <input
                type="checkbox"
                checked={on}
                disabled={frozen}
                onChange={() => onToggle(note.key)}
                aria-label={noteTitle(note)}
                className="size-6 flex-none self-center accent-accent"
              />
              <span className="truncate text-text-muted">{noteTitle(note)}</span>
              <span className={`ml-auto flex-none text-text-faint${on ? '' : ' line-through'}`}>
                {decimal.format(note.tokens)} tok
              </span>
            </span>
            {/* Same owner as the snippet description, and the same reason: a note
                is documentation prose from outside, markup and all. */}
            <MarkdownMessage text={note.content} />
          </div>
        )
      })}
    </div>
  )
}

/** What the service tried to inject — shown, and never sent (DM-17). */
export function RuleList({ rules }: { rules: DocRules }): React.JSX.Element {
  return (
    <div className={LIST}>
      <p className="flex items-start gap-3 text-xs text-warn-text">
        <TriangleAlert
          size={ICON_SIZE.sm}
          strokeWidth={ICON_STROKE}
          className="mt-[2px] flex-none"
        />
        Instruções endereçadas ao modelo. O crivo mostra e nunca envia (DM-17).
      </p>
      {RULE_GROUPS.filter((group) => rules[group.key].length > 0).map((group) => (
        <div key={group.key} className="flex flex-col gap-2">
          <span className="font-ui text-sm font-semibold text-text">{group.label}</span>
          <span className="text-xs text-text-faint">{group.origin}</span>
          <ul className="flex flex-col gap-2">
            {rules[group.key].map((rule) => (
              <li key={rule} className="text-reading leading-normal text-text select-text">
                {rule}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
