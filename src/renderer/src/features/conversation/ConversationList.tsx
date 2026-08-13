import { useState } from 'react'
import type { Conversation } from '@shared/ipc'
import Button from '../../shared/ui/Button/Button'
import { useConversations } from './conversationsContext'
import styles from './ConversationList.module.css'

type RowProps = {
  conversation: Conversation
  active: boolean
  editing: boolean
  onSelect: () => void
  onStartRename: () => void
  onRename: (title: string) => void
  onRemove: () => void
}

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
      <li className={styles.row}>
        <input
          className={styles.rename}
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

  return (
    <li className={[styles.row, active && styles.active].filter(Boolean).join(' ')}>
      <button
        type="button"
        className={styles.select}
        onClick={onSelect}
        aria-current={active || undefined}
      >
        {conversation.title}
      </button>
      <Button
        variant="ghost"
        size="sm"
        className={styles.action}
        aria-label={`Renomear ${conversation.title}`}
        onClick={onStartRename}
      >
        <span aria-hidden="true">✎</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={styles.action}
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

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Conversas</h2>
      {conversations.length === 0 ? (
        <p className={styles.empty}>Nenhuma conversa ainda.</p>
      ) : (
        <ul className={styles.list}>
          {conversations.map((conversation) => (
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
      )}
    </section>
  )
}

export default ConversationList
