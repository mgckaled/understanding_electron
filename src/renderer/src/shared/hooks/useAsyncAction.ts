import { useCallback, useState } from 'react'
import type { JobProgress, Result } from '@shared/ipc'
import type { ViewState } from '../ui/state'

export function useAsyncAction<T>(): {
  state: ViewState<T>
  run: (action: () => Promise<Result<T>>) => Promise<Result<T>>
  setProgress: (progress: JobProgress) => void
  reset: () => void
} {
  const [state, setState] = useState<ViewState<T>>({ status: 'idle' })

  const run = useCallback(async (action: () => Promise<Result<T>>): Promise<Result<T>> => {
    setState({ status: 'loading' })
    const result = await action()
    setState(
      result.ok
        ? { status: 'ready', data: result.value }
        : result.error.kind === 'cancelled'
          ? { status: 'cancelled' }
          : { status: 'error', error: result.error }
    )
    return result
  }, [])

  const setProgress = useCallback((progress: JobProgress): void => {
    setState((prev) => (prev.status === 'loading' ? { status: 'loading', progress } : prev))
  }, [])

  const reset = useCallback((): void => setState({ status: 'idle' }), [])

  return { state, run, setProgress, reset }
}
