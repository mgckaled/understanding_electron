import { useId, cloneElement, isValidElement, type ReactElement } from 'react'

export type FieldControlProps = {
  id?: string
  'aria-describedby'?: string
}

type FieldProps = {
  label: string
  hint?: string
  error?: string
  children: ReactElement<FieldControlProps>
  /**
   * Label beside the control instead of above it (DS-5 fixup) — a composer
   * row of pills wants one line, not each label pushing its own pill down
   * a row and every pill ending at a different height.
   */
  inline?: boolean
}

function Field({ label, hint, error, children, inline = false }: FieldProps): React.JSX.Element {
  const inputId = useId()
  const hintId = useId()
  const errorId = useId()

  const describedBy =
    [hint && !error && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  // Cloning is what keeps this agnostic to the control's type: the real input
  // gets the id and aria-describedby without Field knowing what it is.
  const control = isValidElement<FieldControlProps>(children)
    ? cloneElement(children, { id: inputId, 'aria-describedby': describedBy })
    : children

  return (
    <div className={inline ? 'flex flex-none items-center gap-2' : 'flex flex-col gap-2'}>
      <label
        // text-sm, not text-xs (F-1 fixup, item 3): only the inline form sits
        // in the composer's controls row, next to md-scale icon buttons —
        // block labels (Settings, elsewhere) are untouched.
        className={`flex-none font-semibold whitespace-nowrap text-text-muted ${inline ? 'text-sm' : 'text-xs'}`}
        htmlFor={inputId}
      >
        {label}
      </label>
      {control}
      {hint && !error && (
        <span className="text-xs text-text-faint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="text-xs text-danger-text" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

export default Field
