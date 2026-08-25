import { useState } from 'react'
import type { DatasetPart } from '@shared/ipc'
import { errorMessage } from '../../shared/ui/messages'
import { useSettings } from '../settings/settingsContext'
import { useActiveConversation, useConversations } from '../conversation/conversationsContext'
import { useResolvedContextWindow } from '../conversation/useResolvedContextWindow'

type ProposalState =
  { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string }

/**
 * Requests a step proposal (D9.4/D19.5) and, on success, appends it to the
 * active conversation as an assistant message — its own model call, its own
 * job, no relation to the streaming chat send. Requires a conversation whose
 * model/service are already chosen (D15.13's same lock): a proposal has
 * nowhere else to read them from.
 */
export function useStepProposal(card: DatasetPart): {
  state: ProposalState
  propose: (request: string) => Promise<void>
} {
  const conversation = useActiveConversation()
  const { append } = useConversations()
  const { settings } = useSettings()
  const [state, setState] = useState<ProposalState>({ status: 'idle' })

  // A conversation reaching this hook already has the dataset attached as a
  // message, so it is locked in practice (D15.13) — computed the same way as
  // ConversationView rather than assumed, to match a fresh, unread history.
  const locked =
    conversation !== null && (!conversation.messagesLoaded || conversation.messages.length > 0)
  const numCtx = useResolvedContextWindow({
    modelName: conversation?.settings.model ?? null,
    storedNumCtx: conversation?.settings.numCtx,
    locked
  })

  async function propose(request: string): Promise<void> {
    if (conversation === null || conversation.settings.model === undefined) {
      setState({
        status: 'error',
        message: 'Escolha um modelo nesta conversa antes de propor passos.'
      })
      return
    }

    setState({ status: 'loading' })
    const response = await window.api.ai.propose(
      {
        service: conversation.settings.service ?? 'ollama',
        model: conversation.settings.model,
        hash: card.hash,
        card,
        request,
        numThread: settings.numThread,
        numCtx
      },
      crypto.randomUUID()
    )

    if (!response.ok) {
      setState({ status: 'error', message: errorMessage(response.error) })
      return
    }

    append(conversation.id, {
      role: 'assistant',
      parts: [
        {
          kind: 'stepProposal',
          hash: card.hash,
          proposalKind: response.value.kind,
          steps: response.value.steps
        }
      ]
    })
    setState({ status: 'idle' })
  }

  return { state, propose }
}
