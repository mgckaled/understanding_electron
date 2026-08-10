import { useState } from 'react'
import type { AppError, MessageStopped } from '@shared/ipc'
import { messageText } from '@core/ai/messages'
import Field from '../../shared/ui/Field/Field'
import { errorMessage } from '../../shared/ui/messages'
import { useSettings } from '../settings/settingsContext'
import { useActiveConversation } from './conversationsContext'
import { useConversationChat } from './useConversationChat'
import { useStickToBottom } from './useStickToBottom'
import MarkdownMessage from './MarkdownMessage'
import Composer from './Composer'
import { completePartial } from './completePartial'
import styles from './ConversationView.module.css'

// The model is conversation scale (D13.4), so it stays here. num_thread is
// machine scale and moved to Configurações — reopening an old conversation must
// not restore a thread count that belongs to a different computer. The model
// selector proper, reading /api/tags, is plano 15.
const DEFAULT_MODEL = 'gemma3:4b'

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
  const { settings } = useSettings()
  const [model, setModel] = useState(DEFAULT_MODEL)
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
          <Field label="Modelo">
            <input
              className={styles.input}
              value={model}
              onChange={(event) => setModel(event.target.value)}
              disabled={isLoading}
            />
          </Field>
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

      <Composer disabled={!isReady} loading={isLoading} onSend={send} onCancel={cancel} />
    </section>
  )
}

export default ConversationView
