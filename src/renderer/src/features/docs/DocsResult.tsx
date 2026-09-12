import { useEffect, useState } from 'react'
import { docsPartFrom } from '@core/context7/part'
import type { DocsPart, DocsResult as DocsAnswer } from '@shared/ipc'
import Button from '../../shared/ui/Button/Button'
import Tabs, { type TabDefinition } from '../../shared/ui/Tabs/Tabs'
import DocsSnippetList from './DocsSnippetList'
import { NoteList, RuleList } from './DocsLists'
import { useDocs } from './docsContext'
import { useDocsSelection } from './useDocsSelection'

const decimal = new Intl.NumberFormat('pt-BR')

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
