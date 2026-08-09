import { useState } from 'react'
import type { AppError } from '@shared/ipc'
import Panel from '../../shared/ui/Panel/Panel'
import Toolbar from '../../shared/ui/Toolbar/Toolbar'
import Button from '../../shared/ui/Button/Button'
import Field from '../../shared/ui/Field/Field'
import { errorMessage } from '../../shared/ui/messages'
import { useAiChat } from './useAiChat'
import MarkdownMessage from './MarkdownMessage'
import { completePartial } from './completePartial'
import styles from './AiChatPanel.module.css'

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

function AiChatPanel(): React.JSX.Element {
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [numThread, setNumThread] = useState(DEFAULT_NUM_THREAD)
  const [prompt, setPrompt] = useState('')
  const { availability, turns, streaming, state, send, cancel } = useAiChat(model, numThread)

  const isLoading = state.status === 'loading'
  const isReady = availability.status === 'ready'
  const canSend = isReady && !isLoading && prompt.trim() !== ''

  const onSubmit = (event: React.FormEvent): void => {
    event.preventDefault()
    if (!canSend) return
    void send(prompt)
    setPrompt('')
  }

  return (
    <Panel
      title="Assistente local"
      actions={
        <Toolbar>
          {availability.status === 'ready' && (
            <span className={styles.status}>Ollama {availability.data.version}</span>
          )}
          {isLoading && (
            <Button variant="secondary" onClick={cancel}>
              Cancelar
            </Button>
          )}
        </Toolbar>
      }
    >
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

      {turns.length > 0 && (
        <ol className={styles.thread}>
          {turns.map((turn, index) => (
            <li key={index} className={turn.role === 'user' ? styles.user : styles.assistant}>
              <span className={styles.role}>{turn.role === 'user' ? 'Você' : 'Assistente'}</span>
              {turn.role === 'assistant' ? (
                <MarkdownMessage text={turn.content} />
              ) : (
                <p className={styles.content}>{turn.content}</p>
              )}
            </li>
          ))}
        </ol>
      )}

      {isLoading && streaming !== '' && (
        <div className={styles.streaming} aria-live="polite">
          <MarkdownMessage text={completePartial(streaming)} highlight={false} />
        </div>
      )}
      {state.status === 'error' && (
        <p className={styles.unavailable} role="alert">
          {errorMessage(state.error)}
        </p>
      )}
      {state.status === 'cancelled' && <p className={styles.status}>Resposta cancelada.</p>}

      <form className={styles.form} onSubmit={onSubmit}>
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
        </div>
        <Field label="Mensagem">
          <textarea
            className={styles.textarea}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            disabled={!isReady || isLoading}
            rows={3}
            placeholder="Pergunte algo ao modelo…"
          />
        </Field>
        <Toolbar>
          <Button type="submit" variant="primary" loading={isLoading} disabled={!canSend}>
            Enviar
          </Button>
        </Toolbar>
      </form>
    </Panel>
  )
}

export default AiChatPanel
