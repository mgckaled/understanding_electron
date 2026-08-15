import { useId, useState } from 'react'
import { MoreVertical, Pencil, Search, Trash2 } from 'lucide-react'
import type { Conversation } from '@shared/ipc'
import Button from '../../shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Popover from '../../shared/ui/Popover/Popover'
import { toAnchorName } from '../../shared/ui/Popover/anchorName'
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

// `shape="square"` (Button) already overrides the size's own px-* — `invisible`
// (visibility, not display) keeps the reserved width, so revealing the action
// on hover/focus never shoves the title. First use of the group pattern in the
// project (the group sits on the row).
const ACTION = 'flex-none invisible group-hover:visible group-focus-within:visible'

function ConversationRow({
  conversation,
  active,
  editing,
  onSelect,
  onStartRename,
  onRename,
  onRemove
}: RowProps): React.JSX.Element {
  // Hooks stay unconditional — this row toggles in and out of `editing` without
  // remounting, so both must run every render regardless of which branch below
  // returns.
  const [menuOpen, setMenuOpen] = useState(false)
  const anchorName = toAnchorName(useId())

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

  // The title takes the row and truncates; the kebab keeps its width. A
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
      {/* Same ACTION class as any row control: hidden until hover/focus, width
          still reserved so revealing it never shifts the title. */}
      <Button
        variant="ghost"
        size="sm"
        shape="square"
        className={ACTION}
        style={{ anchorName }}
        aria-label={`Mais ações para ${conversation.title}`}
        aria-haspopup="true"
        onClick={() => setMenuOpen((current) => !current)}
      >
        <MoreVertical size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
      </Button>
      <Popover open={menuOpen} onClose={() => setMenuOpen(false)} anchorName={anchorName}>
        {/* Titled per item VIA aria-label, not visible text (DS-5 fixup): the
            row's own title can be long, and repeating it inside every menu
            item wrapped the popover far past the target's width. A screen
            reader landing directly on one still gets which conversation it
            acts on — just from the label, not the label the sighted user sees. */}
        <div className="flex min-w-[180px] flex-col gap-1">
          <button
            type="button"
            className="flex cursor-pointer items-center gap-3 rounded-md px-4 py-3 text-left font-ui text-xs text-text hover:bg-surface"
            aria-label={`Editar título de ${conversation.title}`}
            onClick={() => {
              setMenuOpen(false)
              onStartRename()
            }}
          >
            <Pencil size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
            Editar título
          </button>
          {/* danger-text, never the solid danger fill, as text (D10.1). */}
          <button
            type="button"
            className="flex cursor-pointer items-center gap-3 rounded-md px-4 py-3 text-left font-ui text-xs text-danger-text hover:bg-surface"
            aria-label={`Excluir ${conversation.title}`}
            onClick={() => {
              setMenuOpen(false)
              onRemove()
            }}
          >
            <Trash2 size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
            Excluir
          </button>
        </div>
      </Popover>
    </li>
  )
}

// Newest first — the store keeps that order, mirroring the ORDER BY that plano
// 14 will run, so the list does not reshuffle when the source changes.
function ConversationList(): React.JSX.Element {
  const { conversations, activeId, select, rename, remove } = useConversations()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const commitRename = (id: string, title: string): void => {
    rename(id, title)
    setEditingId(null)
  }

  // Client-side title filter (DS-3): the titles are already in memory, so this
  // never touches IPC — it is NOT the FTS5 over message text the ROADMAP gates.
  const needle = query.trim().toLowerCase()
  const filtered =
    needle === ''
      ? conversations
      : conversations.filter((conversation) => conversation.title.toLowerCase().includes(needle))

  // Date grouping (Hoje/Ontem/Anteriores) replaces the single "Conversas"
  // heading. The clock is read once at mount (lazy initial state, so the impure
  // Date.now() stays out of render) and passed to the pure groupByDate, which
  // never touches the clock so its level-1 test stays deterministic.
  const [now] = useState(() => Date.now())
  const groups = groupByDate(filtered, now)

  return (
    <section className="flex flex-col gap-4">
      {conversations.length > 0 && (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-text-faint">
            <Search size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
          </span>
          <input
            type="search"
            className="w-full rounded-md border border-border bg-surface-sunken py-3 pr-4 pl-9 font-ui text-sm text-text select-text focus-visible:border-accent-text focus-visible:outline-none"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar conversas"
            aria-label="Buscar conversas"
          />
        </div>
      )}
      {conversations.length === 0 ? (
        <p className="text-xs text-text-faint">Nenhuma conversa ainda.</p>
      ) : groups.length === 0 ? (
        <p className="text-xs text-text-faint">Nenhuma conversa encontrada.</p>
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
