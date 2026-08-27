import { useId, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { ExportFormat } from '@shared/ipc'
import Popover from '../../shared/ui/Popover/Popover'
import { toAnchorName } from '../../shared/ui/Popover/anchorName'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'

type Option = { format: ExportFormat; label: string; soon?: true }

// Four shown, three wired: a format that is coming stays visible and disabled
// rather than absent, so the menu says what the app will do (DS5.7).
const OPTIONS: Option[] = [
  { format: 'md', label: '.md — Markdown' },
  { format: 'txt', label: '.txt — Texto sem marcação' },
  { format: 'docx', label: '.docx — Word' },
  { format: 'pdf', label: '.pdf', soon: true }
]

const TRIGGER =
  'flex h-(--control-height-sm) cursor-pointer items-center gap-2 rounded-md border border-border ' +
  'bg-surface-sunken px-5 font-ui text-xs text-text transition-colors ' +
  'duration-(--duration-fast) ease-initial hover:border-border-strong'

const ROW =
  'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-text ' +
  'hover:bg-surface disabled:cursor-not-allowed disabled:text-text-faint disabled:hover:bg-transparent'

function FormatPicker({
  current,
  onChange
}: {
  current: ExportFormat
  onChange: (format: ExportFormat) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const anchorName = toAnchorName(useId())

  return (
    <>
      <button
        type="button"
        className={TRIGGER}
        style={{ anchorName }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Formato: .${current}`}
        onClick={() => setOpen((value) => !value)}
      >
        .{current}
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
        className="flex w-[260px] flex-col gap-1"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.format}
            type="button"
            className={option.format === current ? `${ROW} font-semibold` : ROW}
            disabled={option.soon}
            title={option.soon === true ? 'Em breve' : undefined}
            aria-current={option.format === current ? 'true' : undefined}
            onClick={() => {
              setOpen(false)
              onChange(option.format)
            }}
          >
            <span className="min-w-[0px] flex-1">{option.label}</span>
            {option.format === current && (
              <Check
                size={ICON_SIZE.sm}
                strokeWidth={ICON_STROKE}
                className="flex-none text-accent-text"
              />
            )}
          </button>
        ))}
      </Popover>
    </>
  )
}

export default FormatPicker
