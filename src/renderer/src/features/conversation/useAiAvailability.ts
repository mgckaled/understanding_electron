import { useEffect, useState } from 'react'
import type { AiAvailability } from '@shared/ipc'
import type { ViewState } from '../../shared/ui/state'

const SERVICE = 'ollama' as const

/**
 * Whether the Ollama service answers. Extracted verbatim from useConversationChat
 * so the conversation view and, from passo 2b, the sidebar footer's status dot
 * read the same probe. Kept as a mount effect rather than a TanStack query on
 * purpose: a separate query cadence resolves availability a tick after the meter,
 * and the composer gate then races the test that types into it (measured). A
 * single shared source with a reload is the footer's concern in passo 2b.
 */
export function useAiAvailability(): ViewState<AiAvailability> {
  const [state, setState] = useState<ViewState<AiAvailability>>({ status: 'loading' })

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
  }, [])

  return state
}
