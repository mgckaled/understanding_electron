import { useId, cloneElement, isValidElement, type ReactElement } from 'react'
import styles from './Field.module.css'

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

  const control = isValidElement<FieldControlProps>(children)
    ? cloneElement(children, { id: inputId, 'aria-describedby': describedBy })
    : children

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      {control}
      {hint && !error && (
        <span className={styles.hint} id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className={styles.error} id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

export default Field
