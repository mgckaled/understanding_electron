function SettingsDialog({ open, onClose, numThread, onNumThread }) {
  const { Dialog, Field, Button } = window.Crivo;
  const loaded = [{ name: 'gemma3:4b', size: '3,3 GB', minutesLeft: 4 }];
  return (
    <Dialog open={open} title="Configurações" onClose={onClose}>
      <p style={{ margin: '0 0 var(--space-6)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
        Ajustes desta máquina. Valem para todas as conversas e não mudam o que o modelo responde.
      </p>
      <Field label="Threads de CPU" hint="Núcleos que o Ollama pode usar nesta máquina.">
        <input type="number" min={1} value={numThread} onChange={(e) => onNumThread(e.target.value)} style={{
          width: 96, padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-sunken)', color: 'var(--color-text)',
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-ui)', fontSize: 'var(--font-size-sm)'
        }} />
      </Field>

      <section style={{ marginTop: 'var(--space-7)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--color-border)' }}>
        <h3 style={{ margin: '0 0 var(--space-3)', color: 'var(--color-text)', fontSize: 'var(--font-size-sm)' }}>Modelos em memória</h3>
        <p style={{ margin: '0 0 var(--space-3)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
          O Ollama mantém os pesos carregados por alguns minutos após a última resposta.
        </p>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', margin: 0, padding: 0, listStyle: 'none' }}>
          {loaded.map((m) => (
            <li key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-sunken)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ flex: 1, color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>{m.name}</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)', whiteSpace: 'nowrap' }}>{m.size} · sai em ~{m.minutesLeft} min</span>
              <Button variant="secondary">Descarregar</Button>
            </li>
          ))}
        </ul>
      </section>
    </Dialog>
  );
}
