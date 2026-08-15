import React from 'react';

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}) {
  const classes = ['btn', `btn-${variant}`, `btn-${size}`, className].filter(Boolean).join(' ');
  return (
    <button className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      <span style={loading ? { visibility: 'hidden' } : undefined}>{children}</span>
      {loading && <span className="btn-spinner" aria-hidden="true" />}
      <style>{`
        .btn { position: relative; display: inline-flex; align-items: center; justify-content: center;
          gap: var(--space-3); border-radius: var(--radius-md); border: 1px solid transparent;
          font-family: var(--font-ui); font-size: var(--font-size-sm); font-weight: 600; cursor: pointer;
          transition: background-color var(--duration-fast) ease, border-color var(--duration-fast) ease;
          white-space: nowrap; }
        .btn:disabled { cursor: not-allowed; opacity: 0.5; }
        .btn-sm { height: var(--control-height-sm); padding: 0 var(--space-5); font-size: var(--font-size-xs); }
        .btn-md { height: var(--control-height-md); padding: 0 var(--space-6); }
        .btn-lg { height: var(--control-height-lg); padding: 0 var(--space-7); font-size: var(--font-size-md); }
        .btn-primary { background: var(--color-accent); color: var(--color-on-accent); }
        .btn-primary:hover:not(:disabled) { background: var(--color-accent-hover); }
        .btn-secondary { background: var(--color-surface-raised); color: var(--color-text); border-color: var(--color-border); }
        .btn-secondary:hover:not(:disabled) { border-color: var(--color-border-strong); }
        .btn-ghost { background: transparent; color: var(--color-text); }
        .btn-ghost:hover:not(:disabled) { background: var(--color-surface-raised); }
        .btn-danger { background: var(--color-danger); color: var(--color-on-danger); }
        .btn-danger:hover:not(:disabled) { filter: brightness(1.1); }
        .btn-spinner { position: absolute; width: var(--space-5); height: var(--space-5);
          border: 2px solid currentColor; border-right-color: transparent; border-radius: var(--radius-full);
          animation: btn-spin var(--duration-slow) linear infinite; }
        @keyframes btn-spin { to { transform: rotate(360deg); } }
      `}</style>
    </button>
  );
}
