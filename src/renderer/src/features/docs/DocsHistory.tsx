import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { docsPartOf } from '@core/ai/messages'
import type { DocsPart } from '@shared/ipc'
import Popover from '../../shared/ui/Popover/Popover'
import { toAnchorName } from '../../shared/ui/Popover/anchorName'
import Switch from '../../shared/ui/Switch/Switch'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { useActiveConversation, useConversations } from '../conversation/conversationsContext'
import { useDocs } from './docsContext'
import { costOf, countsOf } from './summary'

const decimal = new Intl.NumberFormat('pt-BR')

// The same box every other picker trigger in the app wears.
const TRIGGER =
  'flex h-(--control-height-md) max-w-[15rem] min-w-[0px] cursor-pointer items-center gap-2 ' +
  'rounded-md border border-border bg-surface-sunken px-5 font-ui text-sm text-text ' +
  'transition-colors duration-(--duration-fast) ease-initial hover:border-border-strong'

/**
 * Every consultation of this conversation: where to go, and what each one still
 * costs per turn (DM-31).
 *
 * Navigation AND control (D23H.1). The switch repeats the transcript line's
 * without holding any state of its own — both call the same mutation and both
 * read the same persisted `enabled`, so the total at the top is changeable
 * where it is read. The row's link and its switch are SIBLINGS, never nested
 * (D23H.3).
 */
function DocsHistory(): React.JSX.Element | null {
  const conversation = useActiveConversation()
  const { setDocsEnabled } = useConversations()
  const { view } = useDocs()
  const [open, setOpen] = useState(false)
  const anchorName = toAnchorName(useId())

  const rows = (conversation?.messages ?? [])
    .map((message) => ({ messageId: message.id, part: docsPartOf(message) }))
    .filter((row): row is { messageId: string; part: DocsPart } => row.part !== null)

  // Absent, not disabled (DF3B.2): a conversation with nothing consulted has no
  // history to open.
  if (rows.length === 0 || conversation === null) return null

  // Only the active ones: this is the real cost of the next turn, and a turned
  // off consultation contributes nothing to it.
  const active = rows
    .filter((row) => row.part.enabled)
    .reduce((sum, row) => sum + costOf(row.part), 0)

  return (
    <>
      <button
        type="button"
        className={TRIGGER}
        style={{ anchorName }}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">histórico</span>
        <ChevronDown
          size={ICON_SIZE.sm}
          strokeWidth={ICON_STROKE}
          className="flex-none text-text-muted"
        />
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorName={anchorName}
        className="flex w-[24rem] flex-col gap-1"
      >
        <p className="flex items-baseline gap-3 border-b border-border px-3 pb-2 text-xs text-text-muted">
          nesta conversa
          <span className="ml-auto flex-none text-text-faint">
            {decimal.format(active)} tok ativos
          </span>
        </p>
        {rows.map(({ messageId, part }) => (
          <div
            key={part.id}
            className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-surface"
          >
            <button
              type="button"
              className="min-w-[0px] flex-1 cursor-pointer text-left"
              onClick={() => {
                setOpen(false)
                view(part, null)
              }}
            >
              <span className="flex items-baseline gap-3 text-sm text-text">
                <span className="truncate">{part.libraryId}</span>
                <span className="ml-auto flex-none text-xs text-text-faint">
                  {countsOf(part)} · {decimal.format(costOf(part))} tok
                </span>
              </span>
              {/* Two consultations of the same library only differ by this. */}
              <span className="block truncate text-2xs text-text-faint">{part.query}</span>
            </button>
            <Switch
              checked={part.enabled}
              onChange={(next) => setDocsEnabled(conversation.id, messageId, part.id, next)}
              aria-label={`${part.enabled ? 'Tirar' : 'Devolver'} a consulta a ${part.libraryId} do contexto`}
              className="flex-none"
            />
          </div>
        ))}
      </Popover>
    </>
  )
}

export default DocsHistory
