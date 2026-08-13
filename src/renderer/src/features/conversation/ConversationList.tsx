import { useState } from 'react'
import type { Conversation } from '@shared/ipc'
import Button from '../../shared/ui/Button/Button'
import { groupByDate } from './conversations'
import { useConversations } from './conversationsContext'

type RowProps = {
  conversation: Conversation
  active: boolean
  editing: boolean
  onSelect: () => void
  onStartRename: () => void
  onRename: (title: string) => void
  onRemove: () => void
}

// border-l-2 is always present — it is the accent bar's width, reserved so the
// active state only swaps the colour and the title never shifts. The colour is
// conditional PER ROW, never in BASE, so a variant does not lose to it by
// stylesheet order (the DS-1/DS-2 order trap).
const ROW_BASE = 'flex items-center gap-1 rounded-md border-l-2 hover:bg-surface-raised'

// px-3! overrides the Button's own px-5: both set padding-inline, and without
// the important the component's utility wins by stylesheet order, not by class
// order. `invisible` (visibility, not display) keeps the reserved width, so
// revealing the actions on hover/focus never shoves the title — this is the
// first use of the group pattern in the project (the group sits on the row).
const ACTION = 'flex-none px-3! invisible group-hover:visible group-focus-within:visible'

function ConversationRow({
  conversation,
  active,
  editing,
  onSelect,
  onStartRename,
  onRename,
  onRemove
}: RowProps): React.JSX.Element {
  if (editing) {
    return (
      <li className={`${ROW_BASE} border-transparent`}>
        <input
          className="w-full rounded-md border border-accent-text bg-surface-sunken px-4 py-3 font-ui text-sm text-text select-text"
          defaultValue={conversation.title}
          aria-label="Novo título da conversa"
          autoFocus
          // One commit path, two triggers: Enter and Escape both just blur
          // (Escape restores the original first, so cancel commits a no-op).
          // Committing on Enter directly would race the unmount-then-blur across
          // browsers.
          onBlur={(event) => onRename(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            }
            if (event.key === 'Escape') {
              event.currentTarget.value = conversation.title
              event.currentTarget.blur()
            }
          }}
        />
      </li>
    )
  }

  // The title takes the row and truncates; the two actions keep their width. A
  // wrapping title would make rows of different heights out of nothing.
  const selectTone = active ? 'text-text font-semibold' : 'text-text-muted'

  return (
    <li
      className={[
        ROW_BASE,
        'group',
        active ? 'border-accent-text bg-surface-raised' : 'border-transparent'
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className={`flex-1 min-w-[0px] cursor-pointer overflow-hidden rounded-md border-0 bg-transparent px-4 py-3 text-left font-ui text-sm text-ellipsis whitespace-nowrap ${selectTone}`}
        onClick={onSelect}
        aria-current={active || undefined}
      >
        {conversation.title}
      </button>
      <Button
        variant="ghost"
        size="sm"
        className={ACTION}
        aria-label={`Renomear ${conversation.title}`}
        onClick={onStartRename}
      >
        <span aria-hidden="true">✎</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={ACTION}
        aria-label={`Excluir ${conversation.title}`}
        onClick={onRemove}
      >
        <span aria-hidden="true">×</span>
      </Button>
    </li>
  )
}

// Newest first — the store keeps that order, mirroring the ORDER BY that plano
// 14 will run, so the list does not reshuffle when the source changes.
function ConversationList(): React.JSX.Element {
  const { conversations, activeId, select, rename, remove } = useConversations()
  const [editingId, setEditingId] = useState<string | null>(null)

  const commitRename = (id: string, title: string): void => {
    rename(id, title)
    setEditingId(null)
  }

  // Date grouping (Hoje/Ontem/Anteriores) replaces the single "Conversas"
  // heading. The clock is read once at mount (lazy initial state, so the impure
  // Date.now() stays out of render) and passed to the pure groupByDate, which
  // never touches the clock so its level-1 test stays deterministic.
  const [now] = useState(() => Date.now())
  const groups = groupByDate(conversations, now)

  return (
    <section className="flex flex-col gap-5">
      {conversations.length === 0 ? (
        <p className="text-xs text-text-faint">Nenhuma conversa ainda.</p>
      ) : (
        groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <h2 className="text-2xs font-semibold tracking-[0.04em] text-text-faint uppercase">
              {group.label}
            </h2>
            <ul className="flex flex-col gap-1">
              {group.conversations.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  active={conversation.id === activeId}
                  editing={conversation.id === editingId}
                  onSelect={() => select(conversation.id)}
                  onStartRename={() => setEditingId(conversation.id)}
                  onRename={(title) => commitRename(conversation.id, title)}
                  onRemove={() => remove(conversation.id)}
                />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}

export default ConversationList
