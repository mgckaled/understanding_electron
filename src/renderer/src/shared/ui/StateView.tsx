import type { ReactNode } from 'react'
import type { ViewState } from './state'
import { errorMessage } from './messages'

type StateViewProps<T> = {
  state: ViewState<T>
  render: (data: T) => ReactNode
  emptyMessage?: string
}

const STATE = 'flex items-center justify-center p-7 text-sm text-text-muted'
// accent-color is one of the two properties D10.1 allows the solid fill in, and
// --color-accent is deliberately outside the theme so text-accent cannot exist.
const BAR = 'w-full accent-(--color-accent)'

function StateView<T>({
  state,
  render,
  emptyMessage = 'Nada para mostrar.'
}: StateViewProps<T>): ReactNode {
  switch (state.status) {
    case 'idle':
      return null

    case 'loading': {
      const total = state.progress?.total ?? null
      const done = state.progress?.done ?? 0
      return (
        <div className={STATE} role="status">
          {total !== null ? (
            <progress className={BAR} value={done} max={total} />
          ) : (
            <progress className={BAR} />
          )}
        </div>
      )
    }

    case 'ready':
      return render(state.data)

    case 'empty':
      return <div className={STATE}>{emptyMessage}</div>

    case 'cancelled':
      return <div className={STATE}>Operação cancelada.</div>

    case 'error':
      return (
        <div className={STATE} role="alert">
          {errorMessage(state.error)}
        </div>
      )
  }
}

export default StateView
