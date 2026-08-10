import type { AiModel } from '@shared/ipc'
import Field from '../../shared/ui/Field/Field'
import StateView from '../../shared/ui/StateView'
import type { ViewState } from '../../shared/ui/state'
import styles from './ModelSelector.module.css'

/*
 * The selector that replaced a free-text <input> with `gemma3:4b` hardcoded as
 * its default (D15.1/D15.2). Typing `gemma3:4bb` used to produce a generic
 * upstream error, and nothing in the app knew that only one model can see.
 *
 * Chrome density: this sits in the conversation header, next to the title, and
 * is scanned rather than read.
 */

// Capabilities the app has a word for. Everything else renders under its raw
// name, which is what keeps the `string[]` promise alive on screen and not only
// in the type — `insert`, which arrived with the qwen2.5-coder models and which
// nobody predicted, is the first to take that path. `completion` is on every
// model, so it says nothing and is dropped.
const CAPABILITY_LABEL: Record<string, string> = {
  vision: 'imagem',
  tools: 'ferramentas',
  embedding: 'embeddings'
}

function badges(model: AiModel): string[] {
  return model.capabilities
    .filter((capability) => capability !== 'completion')
    .map((capability) => CAPABILITY_LABEL[capability] ?? capability)
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`
}

/**
 * 131072 → "128k", 32768 → "32k". Binary thousands, which is both what the
 * number actually is and how every model card writes it. The exact digits are
 * noise at a glance; the order of magnitude is the decision.
 */
function formatContext(tokens: number | null): string | null {
  return tokens === null ? null : `${Math.round(tokens / 1024)}k`
}

function optionLabel(model: AiModel): string {
  const context = formatContext(model.contextLength)
  return [model.name, formatSize(model.sizeBytes), context].filter(Boolean).join(' · ')
}

type ModelSelectorProps = {
  state: ViewState<AiModel[]>
  /** Already resolved: the conversation's model, or the first installed one. */
  selected: string | null
  disabled: boolean
  onSelect: (name: string) => void
  onReload: () => void
}

function ModelSelector({
  state,
  selected,
  disabled,
  onSelect,
  onReload
}: ModelSelectorProps): React.JSX.Element {
  const current = state.status === 'ready' ? state.data.find((m) => m.name === selected) : undefined

  return (
    <div className={styles.selector}>
      {/*
       * Field must wrap the SELECT, not the StateView. Field works by cloning
       * its child to inject `id` (see skill design-system), so a StateView in
       * between receives the id and the <select> never gets one — leaving a
       * <label for> pointing at nothing. The label is silently decorative at
       * that point, and only a query by label text notices.
       *
       * It also means Field appears only when there IS a control: a label for
       * a select that does not exist is worse than no label.
       */}
      {state.status === 'ready' ? (
        <Field label="Modelo">
          <select
            className={styles.select}
            value={selected ?? ''}
            disabled={disabled}
            onChange={(event) => onSelect(event.target.value)}
          >
            {state.data.map((model) => (
              <option key={model.name} value={model.name}>
                {optionLabel(model)}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <StateView
          state={state}
          emptyMessage="Nenhum modelo instalado."
          // Never called: `ready` is handled above. StateView is here for the
          // other four states, which is the half of it that carries the
          // loading bar and the error registry.
          render={() => null}
        />
      )}

      <button
        type="button"
        className={styles.reload}
        onClick={onReload}
        // Installing a model is a system event with no notification, so the
        // catalog can only be wrong in one direction — stale. The button is the
        // whole answer to that, which is why it is always available.
        title="Recarregar a lista de modelos"
        aria-label="Recarregar a lista de modelos"
      >
        ↻
      </button>

      {current !== undefined && badges(current).length > 0 && (
        <ul className={styles.badges}>
          {badges(current).map((label) => (
            <li key={label} className={styles.badge}>
              {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default ModelSelector
