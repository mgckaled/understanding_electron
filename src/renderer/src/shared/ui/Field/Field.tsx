import { useId, cloneElement, isValidElement, type ReactElement } from 'react'

type FieldControlProps = {
  id?: string
  'aria-describedby'?: string
}

type FieldProps = {
  label: string
  hint?: string
  error?: string
  children: ReactElement<FieldControlProps>
}

function Field({ label, hint, error, children }: FieldProps): React.JSX.Element {
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
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-text-muted" htmlFor={inputId}>
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
