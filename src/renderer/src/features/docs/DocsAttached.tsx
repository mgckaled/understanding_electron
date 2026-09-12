import { useState } from 'react'
import type { DocsPart } from '@shared/ipc'
import Tabs, { type TabDefinition } from '../../shared/ui/Tabs/Tabs'
import DocsSnippetList from './DocsSnippetList'
import { LIST, NoteList, RuleList } from './DocsLists'

const decimal = new Intl.NumberFormat('pt-BR')

/** Everything here was sent, so the boxes are on and inert (D23G.7). */
const ALL_ON = (): boolean => true
const NOOP = (): void => {}

/**
 * A consultation already in the transcript, reopened for reading (D23H.5).
 *
 * Not a mode of DocsResult: that screen carries selection, freezing and the
 * budget verdict, and none of those exist once the choice is frozen. What was
 * left out gets its own tab and shows title and cost alone — the part never
 * kept its code (D23C.3), so re-marking is unexpressable rather than forbidden.
 */
function DocsAttached({ part }: { part: DocsPart }): React.JSX.Element {
  const [active, setActive] = useState('trechos')

  const rules = part.rules
  const ruleCount =
    rules === null ? 0 : rules.global.length + rules.libraryOwn.length + rules.libraryTeam.length
  const sent = [...part.snippets, ...part.notes]
  const tokens = sent.reduce((sum, one) => sum + one.tokens, 0)

  const tabs: TabDefinition[] = [
    {
      id: 'trechos',
      label: `Trechos (${part.snippets.length})`,
      render: () => (
        <DocsSnippetList snippets={part.snippets} isOn={ALL_ON} onToggle={NOOP} frozen />
      )
    },
    {
      id: 'notas',
      label: `Notas (${part.notes.length})`,
      render: () => <NoteList notes={part.notes} isOn={ALL_ON} onToggle={NOOP} frozen />
    },
    // Both absent rather than showing a zero, the rule Regras already followed
    // (D23F.7): an empty list says the same absence as a missing field.
    ...(rules === null || ruleCount === 0
      ? []
      : [
          {
            id: 'regras',
            label: `Regras (${ruleCount}) ⚠`,
            render: () => <RuleList rules={rules} />
          }
        ]),
    ...(part.omitted.length === 0
      ? []
      : [
          {
            id: 'fora',
            label: `Não enviados (${part.omitted.length})`,
            render: () => (
              <ul className={LIST}>
                {part.omitted.map((one) => (
                  <li key={one.key} className="flex items-baseline gap-3 text-xs">
                    <span className="truncate text-text-faint">{one.title}</span>
                    <span className="ml-auto flex-none text-text-faint line-through">
                      {decimal.format(one.tokens)} tok
                    </span>
                  </li>
                ))}
              </ul>
            )
          }
        ])
  ]

  return (
    <>
      <Tabs tabs={tabs} active={active} onChange={setActive} label="Partes da consulta" />

      <div className="flex flex-none items-center justify-between gap-3 border-t border-border px-5 py-4">
        <span className="text-xs text-text-faint">
          {sent.length} de {sent.length + part.omitted.length} · ~{decimal.format(tokens)} tok
        </span>
        {/* The one fact this footer adds over the composing one: whether the
            model is still being sent this, which the transcript's switch
            decides (DM-31). */}
        <span className="flex-none text-xs text-text-faint">
          {part.enabled ? 'no contexto' : 'fora do contexto'}
        </span>
      </div>
    </>
  )
}

export default DocsAttached
