import Toolbar from '../../shared/ui/Toolbar/Toolbar'
import Button from '../../shared/ui/Button/Button'
import StateView from '../../shared/ui/StateView'
import { useOpenDataset } from './useOpenDataset'

// A sidebar section rather than a Panel (D13.7): the shell's chrome supplies the
// surface, so a card would be a border inside a border. A green level-4 test
// (open-dataset.spec.ts) decided the component moves instead of being rewritten.
// Plano 16 moves it into the composer, when attaching becomes part of the conversation.
function OpenDatasetPanel(): React.JSX.Element {
  const { state, pick, cancel } = useOpenDataset()
  const isLoading = state.status === 'loading'

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xs font-semibold tracking-[0.04em] text-text-faint uppercase">
        Abrir arquivo
      </h2>
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
          // display:contents on each pair so dt/dd sit directly in the 2-col grid.
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-xs">
            <div className="contents">
              <dt className="text-text-muted">Separador</dt>
              <dd className="text-text [word-break:break-word]">
                {summary.delimiter === '\t' ? 'tabulação' : summary.delimiter}
              </dd>
            </div>
            <div className="contents">
              <dt className="text-text-muted">Colunas</dt>
              <dd className="text-text [word-break:break-word]">
                {summary.columns.length > 0 ? summary.columns.join(', ') : '—'}
              </dd>
            </div>
            <div className="contents">
              <dt className="text-text-muted">Linhas</dt>
              <dd className="text-text [word-break:break-word]">{summary.rowCount}</dd>
            </div>
          </dl>
        )}
      />
    </section>
  )
}

export default OpenDatasetPanel
