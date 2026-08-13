import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children: ReactNode
}

// Variants live in constants, not JSX, because they are a matrix. ⚠️ Font size
// and border colour are NOT in BASE: two utilities of the same group resolve by
// their order in the generated stylesheet, not the class attribute, so a BASE
// `text-sm` could beat a size's `text-xs` — whatever a variant or size overrides
// belongs only to it. `ease-initial` is CSS `ease` (Tailwind's default differs).
const BASE =
  'relative inline-flex cursor-pointer items-center justify-center gap-3 rounded-md border ' +
  'font-ui font-semibold whitespace-nowrap transition-colors duration-(--duration-fast) ' +
  'ease-initial disabled:cursor-not-allowed disabled:opacity-50'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-accent text-on-accent hover:not-disabled:bg-accent-hover',
  secondary: 'border-border bg-surface-raised text-text hover:not-disabled:border-border-strong',
  ghost: 'border-transparent bg-transparent text-text hover:not-disabled:bg-surface-raised',
  danger: 'border-transparent bg-danger text-on-danger hover:not-disabled:brightness-110'
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-(--control-height-sm) px-5 text-xs',
  md: 'h-(--control-height-md) px-6 text-sm',
  lg: 'h-(--control-height-lg) px-7 text-md'
}

function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  const classes = [BASE, VARIANT[variant], SIZE[size], className].filter(Boolean).join(' ')

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {/* `invisible`, never a transparent colour: the spinner inherits
          currentColor, so it lands on the variant's colour for free. */}
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
