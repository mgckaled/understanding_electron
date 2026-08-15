function Sidebar({ collapsed, onToggle, conversations, activeId, onSelect, onNew, onOpenSettings, modelName }) {
  const { Button } = window.Crivo;
  return (
    <aside style={{
      display: 'grid', gridTemplateRows: 'auto auto minmax(0,1fr) auto',
      width: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)',
      height: '100%', background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)',
      overflow: 'hidden', transition: 'width var(--duration-base) ease'
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'var(--space-3)' }}>
        <Button variant="ghost" size="sm" onClick={onToggle} aria-label={collapsed ? 'Expandir' : 'Recolher'}>
          <span aria-hidden="true">{collapsed ? '»' : '«'}</span>
        </Button>
      </div>
      {!collapsed && (
        <React.Fragment>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: '0 var(--space-4) var(--space-4)' }}>
            <Button variant="secondary" onClick={onNew}>Nova conversa</Button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', minHeight: 0, padding: '0 var(--space-4)', overflowY: 'auto' }}>
            <section>
              <h2 style={{ margin: '0 0 6px', fontSize: 'var(--font-size-2xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-faint)' }}>Conversas</h2>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', margin: 0, padding: 0, listStyle: 'none' }}>
                {conversations.map((c) => (
                  <li key={c.id} style={{ borderRadius: 'var(--radius-md)', background: c.id === activeId ? 'var(--color-surface-raised)' : 'transparent' }}>
                    <button onClick={() => onSelect(c.id)} style={{
                      width: '100%', textAlign: 'left', padding: 'var(--space-3) var(--space-4)', background: 'none', border: 'none',
                      borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 'var(--font-size-sm)',
                      color: c.id === activeId ? 'var(--color-text)' : 'var(--color-text-muted)', fontWeight: c.id === activeId ? 600 : 400,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>{c.title}</button>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 style={{ margin: '0 0 6px', fontSize: 'var(--font-size-2xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-faint)' }}>Abrir arquivo</h2>
              <Button variant="primary" size="sm">Escolher arquivo</Button>
              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', margin: '10px 0 0', fontSize: 'var(--font-size-xs)' }}>
                <dt style={{ color: 'var(--color-text-muted)' }}>Separador</dt><dd style={{ margin: 0, color: 'var(--color-text)' }}>;</dd>
                <dt style={{ color: 'var(--color-text-muted)' }}>Colunas</dt><dd style={{ margin: 0, color: 'var(--color-text)' }}>data, cidade, valor</dd>
                <dt style={{ color: 'var(--color-text-muted)' }}>Linhas</dt><dd style={{ margin: 0, color: 'var(--color-text)' }}>1.240</dd>
              </dl>
            </section>
          </div>
          <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{modelName}</span>
            <Button variant="ghost" size="sm" onClick={onOpenSettings}>Configurações</Button>
          </div>
        </React.Fragment>
      )}
    </aside>
  );
}
