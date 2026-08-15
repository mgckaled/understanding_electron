import React from 'react';

export function Toolbar({ children, className }) {
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
      {children}
    </div>
  );
}
