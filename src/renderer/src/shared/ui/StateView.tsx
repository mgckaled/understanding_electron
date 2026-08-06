import type { ReactNode } from 'react'
import type { ViewState } from './state'
import { errorMessage } from './messages'
import styles from './StateView.module.css'

type StateViewProps<T> = {
  state: ViewState<T>
  render: (data: T) => ReactNode
  emptyMessage?: string
}

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
        <div className={styles.state} role="status">
          {total !== null ? (
            <progress className={styles.bar} value={done} max={total} />
          ) : (
            <progress className={styles.bar} />
          )}
        </div>
      )
    }

    case 'ready':
      return render(state.data)

    case 'empty':
      return <div className={styles.state}>{emptyMessage}</div>

    case 'cancelled':
      return <div className={styles.state}>Operação cancelada.</div>

    case 'error':
      return (
        <div className={styles.state} role="alert">
          {errorMessage(state.error)}
        </div>
      )
  }
}

export default StateView
