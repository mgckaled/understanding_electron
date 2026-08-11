import type { AiModel } from '@shared/ipc'
import { fitsInMemory, MIN_NUM_CTX } from '@core/ai/budget'
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

// Marked, not disabled: free RAM is a snapshot of a machine the user is also
// using, and closing a browser changes the answer (D15.2).
function optionLabel(model: AiModel, ceiling: number | null): string {
  const context = formatContext(model.contextLength)
  const fits = fitsInMemory(ceiling)
  return [model.name, formatSize(model.sizeBytes), context, fits ? '' : 'não cabe']
    .filter(Boolean)
    .join(' · ')
}

type ModelSelectorProps = {
  state: ViewState<AiModel[]>
  /** Already resolved: the conversation's model, or the first installed one. */
  selected: string | null
  disabled: boolean
  onSelect: (name: string) => void
  onReload: () => void
  /** What this conversation reserves; undefined means the provider decides. */
  numCtx?: number
  /**
   * `min(what the model was trained for, what this machine can hold)`, for any
   * model in the list. A function and not a single number for the selection,
   * because the list needs it too — and taking the rule as a parameter keeps it
   * defined in ONE place, together with the margin it is computed against.
   */
  ceilingOf: (model: AiModel) => number | null
  /** Identity of the conversation, so the window control re-reads on switch. */
  scopeKey: string
  onNumCtx: (tokens: number) => void
}

function ModelSelector({
  state,
  selected,
  disabled,
  onSelect,
  onReload,
  numCtx,
  ceilingOf,
  scopeKey,
  onNumCtx
}: ModelSelectorProps): React.JSX.Element {
  const current = state.status === 'ready' ? state.data.find((m) => m.name === selected) : undefined
  const ceiling = current === undefined ? null : ceilingOf(current)
  const fits = fitsInMemory(ceiling)

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
                {optionLabel(model, ceilingOf(model))}
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

      {/* No window at all: offering the control here is what produced "até 0k"
          and a clamp to zero, which the IPC schema then rejected (D15.2). */}
      {current !== undefined && !fits && (
        <p className={styles.tooBig} role="alert">
          Não cabe na memória livre: {formatSize(current.sizeBytes)} de pesos, mais o cache. Feche
          aplicativos e recarregue, ou escolha um modelo menor.
        </p>
      )}

      {fits && ceiling !== null && (
        <Field label="Contexto" hint={`até ${formatContext(ceiling)}`}>
          {/* Uncontrolled and re-keyed: useState(stored) would copy the value on
              the first render, before the conversation read returns (fase 14). */}
          <input
            key={`${scopeKey}:${numCtx ?? 'default'}`}
            className={styles.number}
            type="number"
            min={MIN_NUM_CTX}
            max={ceiling}
            step={MIN_NUM_CTX}
            defaultValue={numCtx ?? ''}
            placeholder={String(ceiling)}
            disabled={disabled}
            // On blur, not per keystroke — clamping while typing turns a cleared
            // field into the floor. The floor also keeps 0 off the IPC boundary.
            onBlur={(event) => {
              const parsed = Number(event.target.value)
              if (!Number.isFinite(parsed) || parsed <= 0) return
              onNumCtx(Math.min(Math.max(Math.round(parsed), MIN_NUM_CTX), ceiling))
            }}
          />
        </Field>
      )}

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
