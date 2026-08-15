import React, { useId, cloneElement, isValidElement } from 'react';

export function Field({ label, hint, error, children }) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const describedBy = [hint && !error && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id: inputId, 'aria-describedby': describedBy })
    : children;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }} htmlFor={inputId}>
        {label}
      </label>
      {control}
      {hint && !error && (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-faint)' }} id={hintId}>{hint}</span>
      )}
      {error && (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger-text)' }} id={errorId} role="alert">{error}</span>
      )}
    </div>
  );
}
