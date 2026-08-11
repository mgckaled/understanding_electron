import Button from '../../shared/ui/Button/Button'
import StateView from '../../shared/ui/StateView'
import { useLoadedModels } from './useLoadedModels'
import styles from './Settings.module.css'

/*
 * What the provider is holding in RAM, with a way to let go of it.
 *
 * Brought forward from plano 17, and manual by design. The provider keeps
 * weights resident for five minutes after the last request, which on this
 * machine is long enough to make most of the fleet read as "não cabe" while
 * nothing is running — and the ceiling is computed from free memory, so the
 * only honest fix is to actually free it.
 *
 * NOT automatic on conversation switch: the provider loads on a REQUEST, not on
 * a selection, so switching costs nothing until something is sent. Unloading
 * there would evict a model because the user looked elsewhere, and charge ~50 s
 * to bring it back.
 */

function formatSize(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`
}

/** Minutes until the provider drops it on its own; null when already due. */
function minutesLeft(expiresAt: number): number | null {
  const ms = expiresAt - Date.now()
  return ms > 0 ? Math.ceil(ms / 60_000) : null
}

function LoadedModels(): React.JSX.Element {
  const { state, unload, unloading } = useLoadedModels()

  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>Modelos em memória</h3>
      <p className={styles.scope}>
        O Ollama mantém os pesos carregados por alguns minutos após a última resposta. Enquanto
        isso, eles contam contra o teto de contexto dos demais modelos.
      </p>
      <StateView
        state={state}
        emptyMessage="Nenhum modelo carregado."
        render={(models) => (
          <ul className={styles.loaded}>
            {models.map((model) => {
              const left = minutesLeft(model.expiresAt)
              return (
                <li key={model.name} className={styles.loadedItem}>
                  <span className={styles.loadedName}>{model.name}</span>
                  <span className={styles.loadedMeta}>
                    {formatSize(model.sizeBytes)}
                    {left === null ? '' : ` · sai em ~${left} min`}
                  </span>
                  <Button
                    variant="secondary"
                    loading={unloading}
                    onClick={() => unload(model.name)}
                  >
                    Descarregar
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      />
    </section>
  )
}

export default LoadedModels
