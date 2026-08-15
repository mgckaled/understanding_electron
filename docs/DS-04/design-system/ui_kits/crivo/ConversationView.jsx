function ConversationView({ conversation, models, selectedModel, onSelectModel, draft, onDraftChange, onSend }) {
  const { Button, Field } = window.Crivo;
  const messages = conversation ? conversation.messages : [];
  const budgetUsed = Math.min(0.35 + draft.length / 400, 1);

  return (
    <section style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-5)', padding: 'var(--space-5) var(--space-7)', borderBottom: '1px solid var(--color-border)' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {conversation ? conversation.title : 'Assistente local'}
        </h1>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
          <Field label="Modelo">
            <select value={selectedModel} onChange={(e) => onSelectModel(e.target.value)} style={{
              maxWidth: 280, padding: 'var(--space-2) var(--space-4)', background: 'var(--color-surface-sunken)', color: 'var(--color-text)',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-ui)', fontSize: 'var(--font-size-xs)'
            }}>
              {models.map((m) => <option key={m.name} value={m.name}>{m.name} · {m.size} · {m.ctx}</option>)}
            </select>
          </Field>
          <button title="Recarregar a lista de modelos" aria-label="Recarregar a lista de modelos" style={{
            alignSelf: 'flex-end', padding: 'var(--space-2) var(--space-3)', background: 'transparent', color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', cursor: 'pointer'
          }}>↻</button>
          <span style={{ alignSelf: 'flex-end', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>Ollama 0.32.6</span>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, padding: 'var(--space-7)', overflowY: 'auto' }}>
        {messages.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--color-text-faint)', fontSize: 'var(--font-size-reading)' }}>Pergunte algo ao modelo para começar uma conversa.</p>
        ) : (
          <ol style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)', margin: 0, padding: 0, listStyle: 'none' }}>
            {messages.map((m) => (
              <li key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--font-size-2xs)', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-faint)' }}>
                  {m.role === 'user' ? 'Você' : 'Assistente'}
                </span>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: 'var(--font-size-reading)', color: 'var(--color-text)' }}>{m.text}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onSend(); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-5) var(--space-7) var(--space-6)', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
        <textarea value={draft} onChange={(e) => onDraftChange(e.target.value)} rows={3} placeholder="Pergunte algo ao modelo…" style={{
          width: '100%', padding: 'var(--space-4) var(--space-5)', background: 'var(--color-surface)', color: 'var(--color-text)',
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-ui)', fontSize: 'var(--font-size-reading)', lineHeight: 1.5, resize: 'vertical'
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '0 var(--space-2)' }}>
          <meter min={0} max={1} low={0.7} high={0.9} optimum={0} value={budgetUsed} style={{ width: 120, height: 6 }} />
          <span style={{ color: 'var(--color-text-faint)', fontSize: 'var(--font-size-2xs)' }}>~{Math.round(budgetUsed * 8192).toLocaleString('pt-BR')} de 8.192 tokens</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <Button type="submit" variant="primary" disabled={draft.trim() === ''}>Enviar</Button>
        </div>
      </form>
    </section>
  );
}
