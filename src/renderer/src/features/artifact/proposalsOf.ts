import type { Message, StepProposalPart } from '@shared/ipc'
import { stepProposalPartOf } from '@core/ai/messages'

export type Proposal = {
  /** The assistant message carrying it — the id `conversation:removeMessage` needs (DF3F.6). */
  messageId: string
  part: StepProposalPart
}

/**
 * Every step proposal the transcript holds for one dataset, oldest first.
 *
 * Derived in one place, like {@link artifactsOf}: the tab and the transcript
 * lines both read this list, and two derivations are how they start
 * disagreeing about which proposal is which.
 */
export function proposalsOf(messages: Message[], hash: string): Proposal[] {
  const found: Proposal[] = []
  for (const message of messages) {
    const part = stepProposalPartOf(message)
    if (part !== null && part.hash === hash) found.push({ messageId: message.id, part })
  }
  return found
}
