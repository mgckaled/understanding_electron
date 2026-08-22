import { useCallback, useEffect, useState } from 'react'
import type { AiAvailability, AiService } from '@shared/ipc'
import type { ViewState } from '../../shared/ui/state'

/**
 * Whether `service` answers, with a manual retry — mirrors `useAiModels`'
 * `{ state, reload }` shape. Kept as a mount effect rather than a TanStack query on
 * purpose: a separate query cadence resolves availability a tick after the meter,
 * and the composer gate then races the test that types into it (measured, DS-3).
 *
 * @param service - Ollama's probe pings a live endpoint; a cloud service's
 *   only checks "is there a key stored" (N-1-B, Peça 9) — same shape, same hook.
 */
export function useAiAvailability(service: AiService): {
  state: ViewState<AiAvailability>
  retry: () => void
} {
  const [state, setState] = useState<ViewState<AiAvailability>>({ status: 'loading' })
  // Which service `state` actually answers for — a changed `service` (N-1-B:
  // switching the selected model's provider) must not keep showing the
  // PREVIOUS service's result while the new probe is in flight. Derived
  // during render, not via setState-in-effect (the anti-pattern the comment
  // on `retry` below already avoids for the mount case).
  const [resolvedFor, setResolvedFor] = useState<AiService | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let active = true
    void window.api.ai.isAvailable(service).then((result) => {
      if (!active) return
      setResolvedFor(service)
      setState(
        result.ok
          ? { status: 'ready', data: result.value }
          : { status: 'error', error: result.error }
      )
    })
    return () => {
      active = false
    }
  }, [service, nonce])

  // Loading is set HERE, not at the top of the effect above — that would be
  // the react-hooks/set-state-in-effect anti-pattern.
  const retry = useCallback((): void => {
    setState({ status: 'loading' })
    setNonce((current) => current + 1)
  }, [])

  return { state: resolvedFor === service ? state : { status: 'loading' }, retry }
}
