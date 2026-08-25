import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../cx'

type SwitchProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'type' | 'children'
> & {
  checked: boolean
  onChange: (checked: boolean) => void
}

// `role="switch"` + `aria-checked`, not a styled checkbox: a switch acts
// immediately (D10.1's colour rule applies — `bg-accent` is a background, so
// the solid form, never `-text`). A real <button> gets Enter/Space activation
// for free, so no key handler is written here.
const TRACK_BASE =
  'relative inline-flex h-[18px] w-[32px] flex-none cursor-pointer items-center rounded-full ' +
  'border border-transparent transition-colors duration-(--duration-fast) ease-initial ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const THUMB_BASE =
  'inline-block h-[14px] w-[14px] rounded-full bg-on-accent transition-transform ' +
  'duration-(--duration-fast) ease-initial'

function Switch({
  checked,
  onChange,
  disabled,
  className,
  ...props
}: SwitchProps): React.JSX.Element {
  const track = checked ? 'bg-accent' : 'bg-surface-sunken border-border'
  const thumb = checked ? 'translate-x-[16px]' : 'translate-x-[2px]'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cx(TRACK_BASE, track, className)}
      onClick={() => onChange(!checked)}
      {...props}
    >
      <span className={`${THUMB_BASE} ${thumb}`} aria-hidden="true" />
    </button>
  )
}

export default Switch
