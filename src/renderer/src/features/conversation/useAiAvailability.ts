import { useCallback, useEffect, useState } from 'react'
import type { AiAvailability } from '@shared/ipc'
import type { ViewState } from '../../shared/ui/state'

const SERVICE = 'ollama' as const

/**
 * Whether the Ollama service answers, with a manual retry — mirrors `useAiModels`'
 * `{ state, reload }` shape. Kept as a mount effect rather than a TanStack query on
 * purpose: a separate query cadence resolves availability a tick after the meter,
 * and the composer gate then races the test that types into it (measured, DS-3).
 */
export function useAiAvailability(): {
  state: ViewState<AiAvailability>
  retry: () => void
} {
  const [state, setState] = useState<ViewState<AiAvailability>>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let active = true
    void window.api.ai.isAvailable(SERVICE).then((result) => {
      if (!active) return
      setState(
        result.ok
          ? { status: 'ready', data: result.value }
          : { status: 'error', error: result.error }
      )
    })
    return () => {
      active = false
    }
  }, [nonce])

  // Loading is set HERE, not at the top of the effect above — that would be
  // the react-hooks/set-state-in-effect anti-pattern.
  const retry = useCallback((): void => {
    setState({ status: 'loading' })
    setNonce((current) => current + 1)
  }, [])

  return { state, retry }
}
