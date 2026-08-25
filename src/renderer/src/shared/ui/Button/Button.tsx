import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../cx'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'
type ButtonShape = 'default' | 'circle' | 'square'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /** `'circle'`/`'square'` render icon-only — the caller must pass
   *  `aria-label` or `aria-labelledby`, since there is no visible text to
   *  fall back to. */
  shape?: ButtonShape
  loading?: boolean
  children: ReactNode
}

// Variants live in constants, not JSX, because they are a matrix. ⚠️ Font size,
// border colour and BORDER RADIUS are NOT in BASE: two utilities of the same
// group resolve by their order in the generated stylesheet, not the class
// attribute, so a BASE `rounded-md` could beat the circle shape's `rounded-full`
// — whatever a variant, size or shape overrides belongs only to it. `ease-initial`
// is CSS `ease` (Tailwind's default differs).
const BASE =
  'relative inline-flex cursor-pointer items-center justify-center gap-3 border ' +
  'font-ui font-semibold whitespace-nowrap transition-colors duration-(--duration-fast) ' +
  'ease-initial disabled:cursor-not-allowed disabled:opacity-50'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-accent text-on-accent hover:not-disabled:bg-accent-hover',
  secondary: 'border-border bg-surface-raised text-text hover:not-disabled:border-border-strong',
  ghost: 'border-transparent bg-transparent text-text hover:not-disabled:bg-surface-raised',
  // Like secondary but with a see-through fill: a visible border on the window
  // ground, the DS-3 target's shape for "Nova conversa". Born with that consumer.
  outline: 'border-border bg-transparent text-text hover:not-disabled:border-border-strong',
  danger: 'border-transparent bg-danger text-on-danger hover:not-disabled:brightness-110'
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-(--control-height-sm) px-5 text-xs',
  md: 'h-(--control-height-md) px-6 text-sm',
  lg: 'h-(--control-height-lg) px-7 text-md'
}

// Rounding is an axis, not a BASE constant (see the ⚠️ above). `circle` and
// `square` are both icon-only buttons: aspect-square ties the width to the
// size's height, and the important px-[0px] beats the size's px-* (the DS-2
// `!` pattern) so padding does not stretch it off-square. `px-[0px]`, not
// `px-0`: with --spacing base off the numeric form emits nothing. `square`
// exists because every icon-only trigger in the app (gear, clip, kebab,
// reload, collapse, Dialog's close) used a TEXT button's horizontal padding
// before DS5, so the hover highlight read as a wide rectangle, never a box
// around the icon (DS-5 fixup).
const SHAPE: Record<ButtonShape, string> = {
  default: 'rounded-md',
  circle: 'aspect-square rounded-full px-[0px]!',
  square: 'aspect-square rounded-md px-[0px]!'
}

function Button({
  variant = 'secondary',
  size = 'md',
  shape = 'default',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  const classes = cx(BASE, VARIANT[variant], SIZE[size], SHAPE[shape], className)

  // `invisible` (visibility:hidden, not a transparent colour, so the spinner
  // still inherits currentColor) also drops the label from the accessible
  // name. Restore it as aria-label when the label is plain text — an
  // explicit aria-label from the caller still wins, since `...props` spreads
  // after this.
  const loadingLabel = loading && typeof children === 'string' ? children : undefined

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={loadingLabel}
      {...props}
    >
      <span className={loading ? 'invisible' : undefined}>{children}</span>
      {loading && (
        <span
          className="animate-spinner absolute h-5 w-5 rounded-full border-2 border-current border-r-transparent"
          aria-hidden="true"
        />
      )}
    </button>
  )
}

export default Button
