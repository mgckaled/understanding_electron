import Button from '../../shared/ui/Button/Button'
import StateView from '../../shared/ui/StateView'
import { useLoadedModels } from './useLoadedModels'

// What the provider is holding in RAM, with a way to let go of it (antecipado do
// plano 17). Manual by design: weights stay resident five minutes after the last
// request, long enough to make the fleet read as "não cabe" while nothing runs,
// and the ceiling is computed from free memory, so the honest fix is to free it.
// NOT automatic on switch — the provider loads on a REQUEST, so switching costs
// nothing until a send.

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

  // Chrome density (D13.6): a modal is scanned, not read.
  return (
    <section className="mt-7 border-t border-border pt-6">
      <h3 className="mb-3 text-sm text-text">Modelos em memória</h3>
      <p className="mb-6 text-xs text-text-muted">
        O Ollama mantém os pesos carregados por alguns minutos após a última resposta. Enquanto
        isso, eles contam contra o teto de contexto dos demais modelos.
      </p>
      <StateView
        state={state}
        emptyMessage="Nenhum modelo carregado."
        render={(models) => (
          <ul className="flex flex-col gap-3">
            {models.map((model) => {
              const left = minutesLeft(model.expiresAt)
              return (
                <li
                  key={model.name}
                  className="flex items-center gap-4 rounded-md border border-border bg-surface-sunken px-4 py-3"
                >
                  {/* The name is the copyable part — it is what `ollama stop <name>` takes. */}
                  <span className="flex-1 font-mono text-xs text-text select-text">
                    {model.name}
                  </span>
                  <span className="text-2xs text-text-muted whitespace-nowrap">
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
