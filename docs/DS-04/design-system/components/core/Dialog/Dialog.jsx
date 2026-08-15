import React, { useEffect, useRef, useId } from 'react';
import { Button } from '../Button/Button';

export function Dialog({ open, title, onClose, children }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const node = ref.current;
    if (node === null || !open) return;
    node.showModal();
    return () => node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      closedby="any"
      aria-labelledby={titleId}
      onClose={onClose}
      style={{
        width: 'min(420px, 90vw)', padding: 0, background: 'var(--color-surface)', color: 'var(--color-text)',
        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontFamily: 'var(--font-ui)', fontSize: 'var(--font-size-sm)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--color-border)' }}>
        <h2 id={titleId} style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 600 }}>{title}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
          <span aria-hidden="true">×</span>
        </Button>
      </div>
      <div style={{ padding: 'var(--space-6)' }}>{children}</div>
      <style>{`dialog::backdrop { background: var(--color-backdrop); }`}</style>
    </dialog>
  );
}
