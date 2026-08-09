import { useState } from 'react'
import type { AppError } from '@shared/ipc'
import { messageText } from '@core/ai/messages'
import Field from '../../shared/ui/Field/Field'
import { errorMessage } from '../../shared/ui/messages'
import { useActiveConversation } from './conversationsContext'
import { useConversationChat } from './useConversationChat'
import { useStickToBottom } from './useStickToBottom'
import MarkdownMessage from './MarkdownMessage'
import Composer from './Composer'
import { completePartial } from './completePartial'
import styles from './ConversationView.module.css'

const DEFAULT_MODEL = 'gemma3:4b'
// Capped for a laptop already running VS Code, a browser and this agent — the
// inference lives in the Ollama process, so this is the one lever the app has
// over its CPU appetite (maps to options.num_thread). See plano 09 D9.1.
const DEFAULT_NUM_THREAD = 4

// The unavailable gate carries a specific hint (D9.3); other errors fall back
// to the shared generic message.
function availabilityText(error: AppError): string {
  return error.kind === 'unavailable' ? error.hint : errorMessage(error)
}

function ConversationView(): React.JSX.Element {
  const conversation = useActiveConversation()
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [numThread, setNumThread] = useState(DEFAULT_NUM_THREAD)
  const { availability, streaming, lastRequestId, state, send, cancel } = useConversationChat(
    model,
    numThread
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
          <Field label="Threads de CPU" hint="Núcleos que o Ollama pode usar nesta máquina.">
            <input
              className={`${styles.input} ${styles.number}`}
              type="number"
              min={1}
              value={numThread}
              onChange={(event) => setNumThread(Math.max(1, Number(event.target.value) || 1))}
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
