import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { docsPartFrom, noteTitle } from '@core/context7/part'
import type { DocNote, DocRules, DocsPart, DocsResult as DocsAnswer } from '@shared/ipc'
import Button from '../../shared/ui/Button/Button'
import MarkdownMessage from '../../shared/ui/MarkdownMessage/MarkdownMessage'
import Tabs, { type TabDefinition } from '../../shared/ui/Tabs/Tabs'
import DocsSnippetList from './DocsSnippetList'
import { useDocs } from './docsContext'
import { useDocsSelection } from './useDocsSelection'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'

const decimal = new Intl.NumberFormat('pt-BR')

const LIST = 'flex min-h-[0px] flex-1 flex-col gap-4 overflow-y-auto p-5'
const EMPTY = 'p-5 text-xs text-text-muted'

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

function NoteList({
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

function RuleList({ rules }: { rules: DocRules }): React.JSX.Element {
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

/**
 * The answer, as its own screen: three tabs, the exact cost at the foot, and the
 * selection that decides what of it reaches the model.
 *
 * @param onBack - Returns to the candidate list, never to the form (D23F.3).
 *   Gone once attached, together with `Anexar` — the choice is frozen (D23G.7).
 */
function DocsResult({ docs, onBack }: { docs: DocsAnswer; onBack: () => void }): React.JSX.Element {
  const [active, setActive] = useState('trechos')
  const { isOn, toggle, offKeys } = useDocsSelection()
  const { setSelectedTokens, budget, current, selected, pending, attach } = useDocs()
  const frozen = pending !== null

  // Read into a const so the narrowing survives into the tab's closure.
  const rules = docs.rules
  const ruleCount =
    rules === null ? 0 : rules.global.length + rules.libraryOwn.length + rules.libraryTeam.length

  // Rules are excluded on purpose: they are never sent, so counting them would
  // inflate the one number in the app that is exact rather than estimated.
  const picked = [...docs.snippets, ...docs.notes].filter((one) => isOn(one.key))
  const tokens = picked.reduce((sum, one) => sum + one.tokens, 0)
  const total = docs.snippets.length + docs.notes.length

  useEffect(() => {
    setSelectedTokens(tokens)
  }, [tokens, setSelectedTokens])

  // Separate from the effect above so it runs on unmount alone: an answer the
  // panel no longer shows must stop charging the composer's meter.
  useEffect(() => {
    return () => setSelectedTokens(0)
  }, [setSelectedTokens])

  // The id is minted here like every id in this app (D14.5), never handed back
  // by a handler. A missing candidate or composition refuses rather than
  // substituting an empty string: `libraryId` is `min(1)`, so the lie would
  // surface as a schema error at `conversation:append`, far from its cause.
  const freeze = (): DocsPart | null =>
    selected === null || current === null
      ? null
      : docsPartFrom({
          id: crypto.randomUUID(),
          libraryId: selected.id,
          libraryTitle: selected.title,
          version: current.version,
          query: current.question,
          docs,
          offKeys
        })

  // Absent, not "cabe", while the window is unknown — no model resolved yet is
  // not a verdict, and the app writes windows out in full everywhere else
  // (ContextControl, ModelSelector), never abbreviated.
  const windowLabel = budget === null ? '' : budget.limit.toLocaleString('pt-BR')
  const verdict =
    budget === null
      ? ''
      : budget.fits
        ? ` · cabe (janela ${windowLabel}, ${Math.max(0, Math.round((1 - budget.used) * 100))}% livre)`
        : ` · não cabe na janela de ${windowLabel}`

  const tabs: TabDefinition[] = [
    {
      id: 'trechos',
      label: `Trechos (${docs.snippets.length})`,
      render: () => (
        <DocsSnippetList snippets={docs.snippets} isOn={isOn} onToggle={toggle} frozen={frozen} />
      )
    },
    {
      id: 'notas',
      label: `Notas (${docs.notes.length})`,
      render: () => <NoteList notes={docs.notes} isOn={isOn} onToggle={toggle} frozen={frozen} />
    },
    // Absent when there is no rule, not a `Regras (0)` (D23F.7): an object with
    // three empty lists says the same absence as a missing field.
    ...(rules === null || ruleCount === 0
      ? []
      : [
          {
            id: 'regras',
            label: `Regras (${ruleCount}) ⚠`,
            render: () => <RuleList rules={rules} />
          }
        ])
  ]

  return (
    <>
      {/* No keepMounted: these are lists, and they survive unmounting. */}
      <Tabs tabs={tabs} active={active} onChange={setActive} label="Partes da resposta" />

      <div className="flex flex-none items-center justify-between gap-3 border-t border-border px-5 py-4">
        {/* The exact cost, not a per-character guess: the API counts each
            snippet and note itself, and this is the only place in the app where
            the budget is known before sending rather than calibrated after. */}
        <span className="text-xs text-text-faint">
          {picked.length} de {total}
          {picked.length === 0 ? ' · nada a anexar' : ` · ~${decimal.format(tokens)} tok${verdict}`}
        </span>
        <span className="flex flex-none items-center gap-3">
          {/* Both gone once attached, not disabled (DF3B.2): the consultation
              is frozen, and going back would offer a way to change what the
              model is about to be sent. */}
          {!frozen && (
            <>
              <Button variant="ghost" size="sm" type="button" onClick={onBack}>
                Voltar
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                // Two reasons to refuse, and the footer beside it names which
                // one (D23G.6). Refusing before the send is the only defence:
                // Ollama drops the prompt's head in silence rather than failing.
                disabled={
                  picked.length === 0 ||
                  budget?.fits === false ||
                  selected === null ||
                  current === null
                }
                onClick={() => {
                  const part = freeze()
                  if (part !== null) attach(part)
                }}
              >
                Anexar
              </Button>
            </>
          )}
        </span>
      </div>
    </>
  )
}

export default DocsResult
