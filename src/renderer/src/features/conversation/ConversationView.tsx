import { useState } from 'react'
import type { AiModel, AppError, MessageStopped } from '@shared/ipc'
import { messageText } from '@core/ai/messages'
import { errorMessage } from '../../shared/ui/messages'
import { useSettings } from '../settings/settingsContext'
import { useActiveConversation, useConversations } from './conversationsContext'
import { useConversationChat } from './useConversationChat'
import { useAiModels } from './useAiModels'
import { resolveModel } from './conversations'
import { useStickToBottom } from './useStickToBottom'
import MarkdownMessage from './MarkdownMessage'
import ModelSelector from './ModelSelector'
import Composer from './Composer'
import { completePartial } from './completePartial'
import styles from './ConversationView.module.css'

/** Stable identity, so a catalog that is loading does not re-run memos. */
const EMPTY_CATALOG: AiModel[] = []

// The unavailable gate carries a specific hint (D9.3); other errors fall back
// to the shared generic message.
function availabilityText(error: AppError): string {
  return error.kind === 'unavailable' ? error.hint : errorMessage(error)
}

// Reading a saved conversation, "there is no answer here" and "the answer was
// cut short" look identical without this (D14.3). The two reasons are told
// apart because the user's own cancel and a deadline are different facts.
const STOPPED_LABEL: Record<MessageStopped, string> = {
  cancelled: 'interrompida por você',
  timeout: 'interrompida por tempo esgotado'
}

function ConversationView(): React.JSX.Element {
  const conversation = useActiveConversation()
  const { updateSettings } = useConversations()
  const { settings } = useSettings()
  const { state: catalog, reload } = useAiModels()

  // Held ONLY for the window in which no conversation exists yet — on a fresh
  // database there is no row to write a setting into.
  const [pending, setPending] = useState<string | undefined>(undefined)
  const installed = catalog.status === 'ready' ? catalog.data : EMPTY_CATALOG

  // Note the branch rather than `conversation?.settings.model ?? pending`: that
  // spelling leaks. A conversation that has chosen nothing yields `undefined`,
  // which falls through to whatever was last clicked in a DIFFERENT
  // conversation — so creating a second one silently inherited the first one's
  // model. Once a conversation exists, only that conversation decides.
  const chosen = conversation === null ? pending : conversation.settings.model
  const model = resolveModel(chosen, installed)

  const chooseModel = (name: string): void => {
    setPending(name)
    if (conversation !== null) updateSettings(conversation.id, { model: name })
  }

  const { availability, streaming, lastRequestId, state, send, cancel } = useConversationChat(
    model,
    settings.numThread
  )

  const messages = conversation?.messages ?? []
  const isLoading = state.status === 'loading'
  const isReady = availability.status === 'ready'
  // The in-flight surface belongs to the conversation the request was sent
  // from, not to whichever one happens to be on screen.
  const belongsHere = lastRequestId !== null && lastRequestId === conversation?.id

  const threadRef = useStickToBottom<HTMLDivElement>(
    `${messages.length}:${streaming.length}`,
    conversation?.id ?? null
  )

  return (
    <section className={styles.view}>
      <header className={styles.header}>
        <h1 className={styles.title}>{conversation?.title ?? 'Assistente local'}</h1>
        <div className={styles.controls}>
          <ModelSelector
            state={catalog}
            selected={model}
            // Changing model mid-answer would leave the reply in flight
            // attributed to a model that is no longer selected. Switching
            // between turns is the point (D15.7) and stays open.
            disabled={isLoading}
            onSelect={chooseModel}
            onReload={reload}
          />
          {isReady && <span className={styles.status}>Ollama {availability.data.version}</span>}
        </div>
      </header>

      <div className={styles.thread} ref={threadRef}>
        {availability.status === 'loading' && (
          <p className={styles.status} role="status">
            Verificando o Ollama…
          </p>
        )}
        {availability.status === 'error' && (
          <p className={styles.unavailable} role="alert">
            {availabilityText(availability.error)}
          </p>
        )}

        {messages.length === 0 && (
          <p className={styles.empty}>Pergunte algo ao modelo para começar uma conversa.</p>
        )}

        {messages.length > 0 && (
          <ol className={styles.messages}>
            {messages.map((message) => (
              <li
                key={message.id}
                className={message.role === 'user' ? styles.user : styles.assistant}
              >
                <span className={styles.role}>
                  {message.role === 'user' ? 'Você' : 'Assistente'}
                  {message.stopped !== undefined && (
                    <span className={styles.stopped}>· {STOPPED_LABEL[message.stopped]}</span>
                  )}
                </span>
                {message.role === 'assistant' ? (
                  <MarkdownMessage text={messageText(message)} />
                ) : (
                  <p className={styles.content}>{messageText(message)}</p>
                )}
              </li>
            ))}
          </ol>
        )}

        {belongsHere && isLoading && streaming !== '' && (
          <div className={styles.streaming} aria-live="polite">
            <MarkdownMessage text={completePartial(streaming)} highlight={false} />
          </div>
        )}
        {belongsHere && state.status === 'error' && (
          <p className={styles.unavailable} role="alert">
            {errorMessage(state.error)}
          </p>
        )}
        {belongsHere && state.status === 'cancelled' && (
          <p className={styles.status}>Resposta cancelada.</p>
        )}
      </div>

      {/* No model installed is as blocking as no service: there is nothing to
          address the call to, so the composer says so by being closed. */}
      <Composer
        disabled={!isReady || model === null}
        loading={isLoading}
        onSend={send}
        onCancel={cancel}
      />
    </section>
  )
}

export default ConversationView
