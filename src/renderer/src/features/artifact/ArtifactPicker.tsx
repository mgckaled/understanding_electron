import { useId, useState } from 'react'
import { Check, ChevronDown, FileText, Image, Table2 } from 'lucide-react'
import Popover from '../../shared/ui/Popover/Popover'
import { toAnchorName } from '../../shared/ui/Popover/anchorName'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { useArtifact, type ArtifactRef } from './artifactContext'

// The panel's own title, and — when the conversation has more than one artifact
// — the way to switch between them (DF3B.5). It answers a concrete question:
// with the panel open and the card twenty messages up, how do you change what
// it shows?

// The same box the ModelPicker trigger wears: sunken well, border, control
// height. A control that reads as a heading is not discoverable, and one sized
// `flex-1` turns the whole header into a click target (F-3-B fixup).
const TRIGGER =
  'flex h-(--control-height-md) max-w-[15rem] min-w-[0px] cursor-pointer items-center gap-2 ' +
  'rounded-md border border-border bg-surface-sunken px-5 font-ui text-sm text-text ' +
  'transition-colors duration-(--duration-fast) ease-initial hover:border-border-strong'

const ROW =
  'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-text hover:bg-surface'

// Exhaustive on purpose: a ternary here defaulted a dataset to the document
// icon, and the two places that draw it disagreed silently.
const ICON: Record<ArtifactRef['kind'], typeof FileText> = {
  document: FileText,
  image: Image,
  dataset: Table2
}

function ArtifactPicker({ current }: { current: ArtifactRef }): React.JSX.Element {
  const { artifacts, toggle } = useArtifact()
  const [open, setOpen] = useState(false)
  const anchorName = toAnchorName(useId())

  const Icon = ICON[current.kind]
  const many = artifacts.length > 1

  function choose(ref: ArtifactRef): void {
    setOpen(false)
    // NOT `toggle`: it closes the panel when handed the artifact already open
    // (DF3A.6), which is right for a card and wrong here — picking the current
    // item in a list means "stay", never "close the thing I am looking at".
    if (ref.id !== current.id) toggle(ref, null)
  }

  // One artifact is not a choice, so it is not a control either — not even a
  // disabled one: an empty box with a chevron promises a list that is not there.
  if (!many) {
    return (
      <p className="flex min-w-[0px] items-center gap-3 text-sm font-medium text-text">
        <Icon size={ICON_SIZE.md} strokeWidth={ICON_STROKE} className="flex-none text-text-muted" />
        <span className="min-w-[0px] overflow-hidden text-ellipsis whitespace-nowrap">
          {current.part.fileName}
        </span>
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
        <Icon size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} className="flex-none text-text-muted" />
        <span className="min-w-[0px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {current.part.fileName}
        </span>
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
        {artifacts.map((ref) => {
          const RowIcon = ICON[ref.kind]
          const isCurrent = ref.id === current.id
          return (
            <button
              key={ref.id}
              type="button"
              className={isCurrent ? `${ROW} font-semibold` : ROW}
              aria-current={isCurrent ? 'true' : undefined}
              onClick={() => choose(ref)}
            >
              <RowIcon
                size={ICON_SIZE.sm}
                strokeWidth={ICON_STROKE}
                className="flex-none text-text-muted"
              />
              <span className="min-w-[0px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {ref.part.fileName}
              </span>
              {/* The mark, not just the weight: bold alone needs the other rows
                  beside it to be read as "this one". */}
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

export default ArtifactPicker
