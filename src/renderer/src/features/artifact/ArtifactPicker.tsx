import { useId, useState } from 'react'
import { ChevronDown, FileText, Image } from 'lucide-react'
import Popover from '../../shared/ui/Popover/Popover'
import { toAnchorName } from '../../shared/ui/Popover/anchorName'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { useArtifact, type ArtifactRef } from './artifactContext'

// The panel's own title, and — when the conversation has more than one artifact
// — the way to switch between them (DF3B.5). It answers a concrete question:
// with the panel open and the card twenty messages up, how do you change what
// it shows? It is also what turns the panel from "the thing I clicked" into
// "what this conversation has".
//
// The F-3-A deliberately left a static title here rather than build a trigger
// with nothing behind it. This is the consumer arriving.
function ArtifactPicker({ current }: { current: ArtifactRef }): React.JSX.Element {
  const { artifacts, toggle } = useArtifact()
  const [open, setOpen] = useState(false)
  const anchorName = toAnchorName(useId())

  const Icon = current.kind === 'image' ? Image : FileText
  // One artifact is not a choice — a menu with a single item that cannot be
  // chosen is chrome pretending to be a control.
  const many = artifacts.length > 1

  function choose(ref: ArtifactRef): void {
    setOpen(false)
    // NOT `toggle`: it closes the panel when handed the artifact already open
    // (DF3A.6), which is right for a card and wrong here — picking the current
    // item in a list means "stay", never "close the thing I am looking at".
    if (ref.id !== current.id) toggle(ref, null)
  }

  return (
    <>
      <button
        type="button"
        className="flex min-w-[0px] flex-1 cursor-pointer items-center gap-3 text-left text-sm font-medium text-text disabled:cursor-default"
        style={{ anchorName }}
        disabled={!many}
        aria-haspopup={many ? 'listbox' : undefined}
        aria-expanded={many ? open : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon size={ICON_SIZE.md} strokeWidth={ICON_STROKE} className="flex-none text-text-muted" />
        <span className="min-w-[0px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {current.part.fileName}
        </span>
        {many && (
          <ChevronDown
            size={ICON_SIZE.sm}
            strokeWidth={ICON_STROKE}
            className="flex-none text-text-muted"
          />
        )}
      </button>
      {/* Not rendered at all with a single artifact: a popover holding one
          unchoosable item is dead DOM that still answers text queries. */}
      {many && (
        <Popover
          open={open}
          onClose={() => setOpen(false)}
          anchorName={anchorName}
          className="flex w-[300px] flex-col gap-1"
        >
          {artifacts.map((ref) => {
            const RowIcon = ref.kind === 'image' ? Image : FileText
            return (
              <button
                key={ref.id}
                type="button"
                className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-text hover:bg-surface ${
                  ref.id === current.id ? 'font-semibold' : ''
                }`}
                aria-current={ref.id === current.id ? 'true' : undefined}
                onClick={() => choose(ref)}
              >
                <RowIcon
                  size={ICON_SIZE.sm}
                  strokeWidth={ICON_STROKE}
                  className="flex-none text-text-muted"
                />
                <span className="min-w-[0px] overflow-hidden text-ellipsis whitespace-nowrap">
                  {ref.part.fileName}
                </span>
              </button>
            )
          })}
        </Popover>
      )}
    </>
  )
}

export default ArtifactPicker
