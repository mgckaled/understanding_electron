import React from 'react';

export function Panel({ title, actions, children, className }) {
  return (
    <section className={className} style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)'
    }}>
      {(title || actions) && (
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)',
          padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--color-border)'
        }}>
          {title && <h2 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)' }}>{title}</h2>}
          {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>{actions}</div>}
        </header>
      )}
      <div style={{ padding: 'var(--space-6)' }}>{children}</div>
    </section>
  );
}
