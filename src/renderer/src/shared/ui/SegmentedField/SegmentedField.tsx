import { useId } from 'react'
import Button from '../Button/Button'

/**
 * A row of mutually exclusive `Button`s standing in for `Field` (DS-4 passo
 * 1): `Field`'s `<label for>` targets a labelable element, which a
 * `role="group"` of buttons is not — `aria-labelledby` is the group's own
 * way to carry that label. Generic because callers reuse the exact shape for
 * unrelated value types (a number of threads, a string enum, a token count).
 *
 * Promoted from `features/settings/Settings.tsx` on its second chamador
 * outside that feature (`ContextControl.tsx`, 21-C-C) — same régua as
 * `SidePanel`/`Tabs`/`CapabilityChip`. `flex-wrap` on the group is new here:
 * Settings' three uses never had more than three options, but a context
 * window's seven fixed bands do not fit one row of a 360px popover.
 */
function SegmentedField<T extends string | number>({
  label,
  hint,
  options,
  value,
  onChange
}: {
  label: string
  hint?: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}): React.JSX.Element {
  const labelId = useId()

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-text-muted" id={labelId}>
        {label}
      </span>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby={labelId}>
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={option.value === value ? 'primary' : 'secondary'}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {hint && <span className="text-xs text-text-faint">{hint}</span>}
    </div>
  )
}

export default SegmentedField
