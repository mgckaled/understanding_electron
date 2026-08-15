import React from 'react';

export function StateView({ state, render, emptyMessage = 'Nada para mostrar.' }) {
  switch (state.status) {
    case 'idle':
      return null;
    case 'loading': {
      const total = state.progress?.total ?? null;
      const done = state.progress?.done ?? 0;
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-7)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }} role="status">
          {total !== null ? (
            <progress style={{ width: '100%', accentColor: 'var(--color-accent)' }} value={done} max={total} />
          ) : (
            <progress style={{ width: '100%', accentColor: 'var(--color-accent)' }} />
          )}
        </div>
      );
    }
    case 'ready':
      return render(state.data);
    case 'empty':
      return <div style={{ padding: 'var(--space-7)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>{emptyMessage}</div>;
    case 'cancelled':
      return <div style={{ padding: 'var(--space-7)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Operação cancelada.</div>;
    case 'error':
      return <div style={{ padding: 'var(--space-7)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }} role="alert">{state.error?.message ?? 'Ocorreu um erro inesperado.'}</div>;
    default:
      return null;
  }
}
