import type { Message, MessageStopped } from '@shared/ipc'
import { attachmentPartOf, messageText, stepProposalPartOf } from '@core/ai/messages'
import MarkdownMessage from '../../shared/ui/MarkdownMessage/MarkdownMessage'
import AttachmentCard from '../attachment/AttachmentCard'
import StepProposalLine from '../attachment/StepProposalLine'
import TurnActions from './TurnActions'

// Reading a saved conversation, "there is no answer here" and "the answer was
// cut short" look identical without this (D14.3). The two reasons are told
// apart because the user's own cancel and a deadline are different facts.
const STOPPED_LABEL: Record<MessageStopped, string> = {
  cancelled: 'interrompida por você',
  timeout: 'interrompida por tempo esgotado'
}

// The transcript, and only it (DF3B.6): which shape a turn takes, and which
// card replaces the text. It takes one prop on purpose — everything else in the
// view is orchestration, and the split is worth nothing if state follows the
// markup out.
//
// The scrolling <div> stays with ConversationView, so the ref useStickToBottom
// measures never changes element — the failure the hook's own comment warns
// about does not arise here.
function MessageList({ messages }: { messages: Message[] }): React.JSX.Element {
  return (
    <ol className="flex flex-col gap-7">
      {messages.map((message) => {
        const attachment = attachmentPartOf(message)
        return message.role === 'user' ? (
          // User turn: a bubble on the right. Alignment and fill carry the
          // authorship, so the "Você" label the target drops is gone. Reading
          // density (D13.6); select-text opts back into selection that base.css
          // turns off at the root. The attachment card (D16.4 Passo 4), when
          // present, is its own element above the bubble — never inlined into
          // the text the model reads.
          <li key={message.id} className="flex flex-col items-end gap-2">
            {attachment !== null && <AttachmentCard part={attachment} />}
            <p className="max-w-[80%] rounded-lg bg-surface-raised px-5 py-4 text-reading leading-normal whitespace-pre-wrap text-text select-text">
              {messageText(message)}
            </p>
          </li>
        ) : (
          // Assistant turn: plain text on the left, no bubble, no label. A step
          // proposal replaces the text entirely — the reply IS the line, and it
          // opens the panel where the steps are edited (DF3F.1).
          <li key={message.id} className="flex flex-col gap-2">
            {(() => {
              const proposal = stepProposalPartOf(message)
              return proposal !== null ? (
                <StepProposalLine part={proposal} messageId={message.id} />
              ) : (
                <MarkdownMessage text={messageText(message)} />
              )
            })()}
            {message.stopped !== undefined && (
              // Why a reply stopped (D14.3). Warn, not danger — a cut answer
              // says less, it is not an error.
              <span className="text-2xs text-warn-text">{STOPPED_LABEL[message.stopped]}</span>
            )}
            <TurnActions text={messageText(message)} messageId={message.id} />
          </li>
        )
      })}
    </ol>
  )
}

export default MessageList
