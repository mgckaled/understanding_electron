import { useId, useState } from 'react'
import { Check, ChevronDown, NotebookPen } from 'lucide-react'
import type { Draft } from '@shared/ipc'
import Popover from '../../shared/ui/Popover/Popover'
import { toAnchorName } from '../../shared/ui/Popover/anchorName'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { useDraft } from './draftContext'

// The same box the ArtifactPicker and ModelPicker triggers wear: sunken well,
// border, control height. A control that reads as a heading is not
// discoverable, and one sized `flex-1` turns the whole header into a target.
const TRIGGER =
  'flex h-(--control-height-md) max-w-[15rem] min-w-[0px] cursor-pointer items-center gap-2 ' +
  'rounded-md border border-border bg-surface-sunken px-5 font-ui text-sm text-text ' +
  'transition-colors duration-(--duration-fast) ease-initial hover:border-border-strong'

const ROW =
  'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-text hover:bg-surface'

const NAME = 'min-w-[0px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap'

function DraftPicker({ current }: { current: Draft }): React.JSX.Element {
  const { drafts, toggle } = useDraft()
  const [open, setOpen] = useState(false)
  const anchorName = toAnchorName(useId())

  function choose(draft: Draft): void {
    setOpen(false)
    // NOT the panel's toggle semantics: picking the current item in a list
    // means "stay", never "close the thing I am looking at" (DF3B.5).
    if (draft.id !== current.id) toggle(draft, null)
  }

  // One draft is not a choice, so it is not a control either — not even a
  // disabled one: an empty box with a chevron promises a list that is not there.
  if (drafts.length <= 1) {
    return (
      <p className="flex min-w-[0px] items-center gap-3 text-sm font-medium text-text">
        <NotebookPen
          size={ICON_SIZE.md}
          strokeWidth={ICON_STROKE}
          className="flex-none text-text-muted"
        />
        <span className={NAME}>{current.title}</span>
      </p>
    )
  }

  return (
    <>
      <button
        type="button"
        className={TRIGGER}
        style={{ anchorName }}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <NotebookPen
          size={ICON_SIZE.sm}
          strokeWidth={ICON_STROKE}
          className="flex-none text-text-muted"
        />
        <span className={NAME}>{current.title}</span>
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
        className="flex w-[300px] flex-col gap-1"
      >
        {drafts.map((draft) => {
          const isCurrent = draft.id === current.id
          return (
            <button
              key={draft.id}
              type="button"
              className={isCurrent ? `${ROW} font-semibold` : ROW}
              aria-current={isCurrent ? 'true' : undefined}
              onClick={() => choose(draft)}
            >
              <span className={NAME}>{draft.title}</span>
              {isCurrent && (
                <Check
                  size={ICON_SIZE.sm}
                  strokeWidth={ICON_STROKE}
                  className="flex-none text-accent-text"
                />
              )}
            </button>
          )
        })}
      </Popover>
    </>
  )
}

export default DraftPicker
