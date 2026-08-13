import type { AiModel } from '@shared/ipc'
import { fitsInMemory, MIN_NUM_CTX, type ConversationWindow } from '@core/ai/budget'
import Field from '../../shared/ui/Field/Field'
import StateView from '../../shared/ui/StateView'
import type { ViewState } from '../../shared/ui/state'

// The selector that replaced a free-text <input> defaulting to `gemma3:4b`
// (D15.1/D15.2): a typo used to produce a generic upstream error, and nothing
// knew which model can see. Chrome density — in the header, scanned not read.

// Replaces the context control when no window fits; used from two states.
const TOO_BIG = 'max-w-[320px] self-end text-2xs text-warn-text'

// Capabilities the app has a word for; everything else renders under its raw
// name, keeping the `string[]` promise alive on screen (`insert` arrived
// unpredicted). `completion` is on every model, says nothing, and is dropped.
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
 * 131072 → "128k", 32768 → "32k". Binary thousands — what the number is and how
 * model cards write it; the order of magnitude is the decision, not the digits.
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
  /** The pair closed on this conversation's first send (D15.13). */
  locked: boolean
  onSelect: (name: string) => void
  onReload: () => void
  /** The window in force, and whether it can be changed or even used. */
  contextWindow: ConversationWindow
  /**
   * `min(trained ceiling, what this machine can hold)`, for any model in the
   * list. A function, not one number for the selection, because the list needs
   * it too — and passing the rule keeps it defined in ONE place with its margin.
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
  locked,
  onSelect,
  onReload,
  contextWindow,
  ceilingOf,
  scopeKey,
  onNumCtx
}: ModelSelectorProps): React.JSX.Element {
  const current = state.status === 'ready' ? state.data.find((m) => m.name === selected) : undefined
  const ceiling = current === undefined ? null : ceilingOf(current)
  const fits = fitsInMemory(ceiling)

  // Chrome density (D13.6): lives in the conversation header, scanned not read.
  return (
    <div className="flex flex-none items-start gap-3">
      {/* Field must wrap the SELECT, not the StateView: Field clones its child
          to inject `id` (skill design-system), so a StateView between would take
          the id and the <select> would get none, leaving <label for> pointing at
          nothing. So Field appears only when there IS a control. */}
      {state.status === 'ready' ? (
        <Field label="Modelo">
          {/* Style the box only; base.css restores the native <option> popup padding. */}
          <select
            className="max-w-[280px] rounded-md border border-border bg-surface-sunken px-4 py-2 font-ui text-xs text-text focus-visible:border-accent-text focus-visible:outline-none disabled:text-text-faint"
            value={selected ?? ''}
            // Locked, not merely busy: switching to a smaller model strands the
            // conversation — the gate correctly refuses a history that no longer
            // fits, and there is no way back (D15.13).
            disabled={disabled || locked}
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
        className="cursor-pointer self-end rounded-md border border-border bg-transparent px-3 py-2 text-xs leading-none text-text-muted hover:text-text"
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
      {current !== undefined && contextWindow.status === 'too-large' && (
        <p className={TOO_BIG} role="alert">
          Não cabe na memória livre: {formatSize(current.sizeBytes)} de pesos, mais o cache. Feche
          aplicativos e recarregue
          {locked ? ', ou comece uma conversa nova.' : ', ou escolha um modelo menor.'}
        </p>
      )}

      {/* The lock's asymmetric second failure mode: the reservation is remade on
          every load and free RAM varies by 3 GB here, so refusing is the point —
          shrinking in silence would undo the lock's guarantee (D15.13). */}
      {contextWindow.status === 'unaffordable' && (
        <p className={TOO_BIG} role="alert">
          Esta conversa reservou {contextWindow.numCtx.toLocaleString('pt-BR')} tokens, e a memória
          livre agora não comporta. Feche aplicativos e recarregue.
        </p>
      )}

      {contextWindow.status === 'locked' && (
        // my-5 restates the browser's 1em on <p> that preflight zeroes, kept to
        // hold the pixel; the sibling TOO_BIG sets 0, and which is right is a
        // DS-3 question (DS1.6). A stated number, not a control (D15.13).
        <p className="my-5 self-end py-2 text-xs whitespace-nowrap text-text-muted">
          Contexto: {contextWindow.numCtx.toLocaleString('pt-BR')} tokens · travado
        </p>
      )}

      {contextWindow.status === 'open' && fits && ceiling !== null && (
        <Field label="Contexto" hint={`até ${formatContext(ceiling)}`}>
          {/* Uncontrolled and re-keyed: useState(stored) would copy the value on
              the first render, before the conversation read returns (fase 14). */}
          <input
            key={`${scopeKey}:${contextWindow.numCtx}`}
            className="w-[88px] rounded-md border border-border bg-surface-sunken px-4 py-2 font-ui text-xs text-text focus-visible:border-accent-text focus-visible:outline-none"
            type="number"
            min={MIN_NUM_CTX}
            max={ceiling}
            step={MIN_NUM_CTX}
            defaultValue={contextWindow.numCtx}
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
        <ul className="flex self-end gap-2">
          {badges(current).map((label) => (
            // A capability with no label of its own renders under its raw name,
            // so this stays legible for text nobody chose (`insert` was first).
            <li
              key={label}
              className="rounded-sm border border-border bg-surface-raised px-3 py-1 text-2xs whitespace-nowrap text-text-muted"
            >
              {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default ModelSelector
