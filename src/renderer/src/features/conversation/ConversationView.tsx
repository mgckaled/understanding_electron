import { useState } from 'react'
import type { AiModel, AppError, ConversationSettings, MessageStopped } from '@shared/ipc'
import { messageText } from '@core/ai/messages'
import { calibrateRatio, conversationWindow } from '@core/ai/budget'
import { contextCeiling, RAM_MARGIN_BYTES } from '@core/ai/memory'
import { errorMessage } from '../../shared/ui/messages'
import { useSystemMemory } from '../../shared/hooks/useSystemMemory'
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
  // database there is no row to write a setting into, and dropping the choice
  // silently is worse than holding it.
  const [pending, setPending] = useState<ConversationSettings>({})
  // Already filtered by the hook, so this list and the one the selector draws
  // are the same object — see D15.11 for what happened when they were not.
  const installed = catalog.status === 'ready' ? catalog.data : EMPTY_CATALOG

  // Note the branch rather than `conversation?.settings.model ?? pending`: that
  // spelling leaks. A conversation that has chosen nothing yields `undefined`,
  // which falls through to whatever was last chosen in a DIFFERENT
  // conversation — so creating a second one silently inherited the first one's
  // model. Once a conversation exists, only that conversation decides.
  const chosen = conversation === null ? pending : conversation.settings
  const messages = conversation?.messages ?? []
  // The pair closes on the first send, not at creation (D15.13). An unread
  // transcript counts as locked: `messages` is `[]` while it is in flight, and
  // unlocking a saved conversation for a frame is the direction that hurts.
  const locked = conversation !== null && (!conversation.messagesLoaded || messages.length > 0)
  const model = resolveModel(chosen.model, installed, locked)

  // min(what the model was trained for, what this machine can hold) — the
  // second bound is the one that matters: phi4-mini truthfully declares 131072
  // and honouring it means reserving 16 GB of cache on a 16 GB machine. Defined
  // once here and passed down, so the margin is applied in a single place.
  const { memory, reload: reloadMemory } = useSystemMemory()
  const ceilingOf = (entry: AiModel): number | null =>
    memory === undefined ? null : contextCeiling(entry, memory.freeBytes, RAM_MARGIN_BYTES)

  const current = installed.find((entry) => entry.name === model)
  const ceiling = current === undefined ? null : ceilingOf(current)

  // One writer for both settings: hold it locally so a choice made before any
  // conversation exists is not dropped in silence, and persist it as soon as
  // there is a row to persist into.
  const choose = (patch: ConversationSettings): void => {
    setPending((current) => ({ ...current, ...patch }))
    if (conversation !== null) updateSettings(conversation.id, patch)
  }

  // The window actually in force. Sent explicitly on every call, because NOT
  // sending it is what leaves Ollama's own 4096 in charge — a number nobody
  // chose and one that a single document overflows in silence.
  const contextWindow = conversationWindow({ locked, reserved: chosen.numCtx, ceiling })
  const numCtx =
    contextWindow.status === 'open' || contextWindow.status === 'locked'
      ? contextWindow.numCtx
      : null

  const { availability, streaming, lastRequestId, state, send, cancel, lastPrompt } =
    useConversationChat(model, settings.numThread, numCtx ?? undefined)

  // What the next send would carry: the whole transcript, since the provider is
  // stateless and every turn resends everything.
  const historyChars = messages.reduce((total, message) => total + messageText(message).length, 0)
  // Generic ratio on the first turn, this conversation's own from then on — the
  // exact count only exists AFTER a call (D15.4). NOT `historyChars`: that
  // already holds the reply, which the call being measured never sent, and the
  // two together made the formula cancel itself (D15.14).
  const charsPerToken = calibrateRatio(lastPrompt?.chars ?? 0, lastPrompt?.tokens)
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
            // Two different reasons to be inert: busy, which passes, and
            // locked, which does not (D15.13).
            disabled={isLoading}
            locked={locked}
            onSelect={(name) => choose({ model: name })}
            // Both, because both readings are snapshots the app cannot observe
            // changing: a model installed since launch, and memory freed since.
            onReload={() => {
              reload()
              reloadMemory()
            }}
            contextWindow={contextWindow}
            ceilingOf={ceilingOf}
            // Remounts the window control when the conversation changes, so it
            // re-reads that conversation's value instead of showing the last
            // one typed.
            scopeKey={conversation?.id ?? 'sem-conversa'}
            onNumCtx={(tokens) => choose({ numCtx: tokens })}
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

        {/* Under the lock, falling back to the first installed model would have
            the conversation answered by a model its own history never used
            (D15.13). Offering to duplicate it elsewhere is what the plan
            defers; saying so is not. */}
        {locked && model === null && chosen.model !== undefined && (
          <p className={styles.unavailable} role="alert">
            O modelo <strong>{chosen.model}</strong> desta conversa não está mais instalado. Ela
            fica somente leitura — reinstale o modelo ou comece uma conversa nova.
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
          address the call to, so the composer says so by being closed. A model
          too large for the free memory is the third case — the reason for it is
          in the header, next to the choice that fixes it. */}
      <Composer
        disabled={!isReady || model === null || numCtx === null}
        loading={isLoading}
        // The gate's ways out are not the same under the lock: two of the three
        // it used to offer no longer exist (D15.13).
        locked={locked}
        onSend={send}
        onCancel={cancel}
        historyChars={historyChars}
        limit={numCtx}
        charsPerToken={charsPerToken}
      />
    </section>
  )
}

export default ConversationView
