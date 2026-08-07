import Panel from '../../shared/ui/Panel/Panel'
import Toolbar from '../../shared/ui/Toolbar/Toolbar'
import Button from '../../shared/ui/Button/Button'
import StateView from '../../shared/ui/StateView'
import { useOpenDataset } from './useOpenDataset'
import styles from './OpenDatasetPanel.module.css'

function OpenDatasetPanel(): React.JSX.Element {
  const { state, pick, cancel } = useOpenDataset()
  const isLoading = state.status === 'loading'

  return (
    <Panel
      title="Abrir arquivo"
      actions={
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
      }
    >
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
    </Panel>
  )
}

export default OpenDatasetPanel
