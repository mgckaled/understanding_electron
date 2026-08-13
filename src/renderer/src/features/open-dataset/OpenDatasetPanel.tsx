import Toolbar from '../../shared/ui/Toolbar/Toolbar'
import Button from '../../shared/ui/Button/Button'
import StateView from '../../shared/ui/StateView'
import { useOpenDataset } from './useOpenDataset'
import styles from './OpenDatasetPanel.module.css'

// A sidebar section rather than a Panel (D13.7): the shell's chrome supplies the
// surface, so a card would be a border inside a border. A green level-4 test
// (open-dataset.spec.ts) decided the component moves instead of being rewritten.
// Plano 16 moves it into the composer, when attaching becomes part of the conversation.
function OpenDatasetPanel(): React.JSX.Element {
  const { state, pick, cancel } = useOpenDataset()
  const isLoading = state.status === 'loading'

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Abrir arquivo</h2>
      <Toolbar>
        <Button variant="primary" onClick={pick} loading={isLoading} disabled={isLoading}>
          Escolher arquivo
        </Button>
        {isLoading && (
          <Button variant="secondary" onClick={cancel}>
            Cancelar
          </Button>
        )}
      </Toolbar>
      <StateView
        state={state}
        emptyMessage="Nenhum arquivo aberto ainda."
        render={(summary) => (
          <dl className={styles.summary}>
            <div>
              <dt>Separador</dt>
              <dd>{summary.delimiter === '\t' ? 'tabulação' : summary.delimiter}</dd>
            </div>
            <div>
              <dt>Colunas</dt>
              <dd>{summary.columns.length > 0 ? summary.columns.join(', ') : '—'}</dd>
            </div>
            <div>
              <dt>Linhas</dt>
              <dd>{summary.rowCount}</dd>
            </div>
          </dl>
        )}
      />
    </section>
  )
}

export default OpenDatasetPanel
