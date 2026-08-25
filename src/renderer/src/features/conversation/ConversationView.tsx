import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type {
  AiModel,
  AiService,
  AppError,
  ConversationSettings,
  MessageStopped
} from '@shared/ipc'
import { attachmentPartOf, imageCountOf, messageText, toChatMessages } from '@core/ai/messages'
import { calibrateRatio, conversationWindow } from '@core/ai/budget'
import { contextCeiling, RAM_MARGIN_BYTES } from '@core/ai/memory'
import { errorMessage } from '../../shared/ui/messages'
import Button from '../../shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import MarkdownMessage from '../../shared/ui/MarkdownMessage/MarkdownMessage'
import { useSystemMemory } from '../../shared/hooks/useSystemMemory'
import { useSettings } from '../settings/settingsContext'
import AttachmentCard from '../attachment/AttachmentCard'
import { useActiveConversation, useConversations } from './conversationsContext'
import { useConversationChat } from './useConversationChat'
import { useAiModels } from './useAiModels'
import { useAiAvailability } from './useAiAvailability'
import { useCloudCatalog } from './useCloudCatalog'
import { resolveModel } from './conversations'
import { useStickToBottom } from './useStickToBottom'
import ContextControl from './ContextControl'
import { ModelPicker, BudgetMeter } from './ModelSelector'
import Composer from './Composer'
import ThinkingMark from './ThinkingMark'
import TurnActions from './TurnActions'
import { completePartial } from './completePartial'

/** Stable identity, so a catalog that is loading does not re-run memos. */
const EMPTY_CATALOG: AiModel[] = []

// Reused class strings: the muted status line and the warn notice, each drawn
// from three different branches below.
const STATUS = 'text-xs text-text-muted'
const UNAVAILABLE = 'mb-5 text-sm text-warn-text'

// The unavailable gate carries a specific hint (D9.3); other errors fall back
// to the shared generic message.
function availabilityText(error: AppError): string {
  return error.kind === 'unavailable' ? error.hint : errorMessage(error)
}

// The loading line names whichever service the composer is currently
// addressing (N-1-B) — it used to say "o Ollama" unconditionally.
const SERVICE_LABEL: Record<AiService, string> = {
  ollama: 'o Ollama',
  glm: 'o GLM',
  gemini: 'o Gemini'
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
  const { state: catalog, reload } = useAiModels('ollama')
  // Split into its own hook once this file crossed the design system's
  // 400-line cap (N-1-C, passo 7) — see useCloudCatalog.ts.
  const { cloudModels, cloudReadyFor, cloudHintFor } = useCloudCatalog()

  // Held ONLY for the window in which no conversation exists yet — on a fresh
  // database there is no row to write a setting into, and dropping the choice
  // silently is worse than holding it.
  const [pending, setPending] = useState<ConversationSettings>({})
  // Already filtered by the hook, so this list and the one the selector draws
  // are the same object — see D15.11 for what happened when they were not.
  const installed = catalog.status === 'ready' ? catalog.data : EMPTY_CATALOG
  // Ollama first, always — and NOT appended while `catalog` is still
  // loading (N-1-B). GLM_MODELS resolves synchronously, the Ollama catalog
  // does not; concatenating them unconditionally let GLM win allModels[0]
  // (resolveModel's unset-choice fallback) on every fresh render, purely
  // because Ollama had not answered yet — a timing accident, not the
  // "nuvem is opt-in, never the silent default" the comment on resolveModel
  // below actually wants. Once `catalog` settles (ready, error or empty),
  // `installed` reflects that and this stops racing.
  const allModels = catalog.status === 'loading' ? installed : [...installed, ...cloudModels]

  // Branch, not `conversation?.settings.model ?? pending`: that spelling leaks —
  // a conversation that chose nothing yields `undefined` and falls through to
  // another conversation's last choice. Once one exists, only it decides.
  const chosen = conversation === null ? pending : conversation.settings
  const messages = conversation?.messages ?? []
  // The pair closes on the first send, not at creation (D15.13). An unread
  // transcript counts as locked: `messages` is `[]` while it is in flight, and
  // unlocking a saved conversation for a frame is the direction that hurts.
  const locked = conversation !== null && (!conversation.messagesLoaded || messages.length > 0)
  // Fed allModels, not just the local catalog (N-1-B) — resolveModel falls
  // back to null (locked) or the first entry (unlocked) when `chosen.model`
  // is absent from the catalog it is given; feeding it only Ollama's list
  // would null out a locked GLM conversation on reload, or silently revert an
  // unlocked GLM pick back to the first local model.
  const model = resolveModel(chosen.model, allModels, locked)

  // min(trained ceiling, what this machine can hold) for Ollama — see
  // contextCeiling. For a cloud model (attention: null, N-1-C, DN1C.2) there
  // is no RAM to bound against, so the ceiling is the model's own trained
  // window: `contextCeiling` already returns null for that case (right for
  // "does not cost RAM", wrong for "what should the slider offer"), and this
  // is the one place that turns null into the real number instead of leaving
  // the window stuck at DEFAULT_NUM_CTX with no control to change it.
  const { memory, reload: reloadMemory } = useSystemMemory()
  const ceilingOf = (entry: AiModel): number | null =>
    entry.attention === null
      ? entry.contextLength
      : memory === undefined
        ? null
        : contextCeiling(entry, memory.freeBytes, RAM_MARGIN_BYTES)

  const current = allModels.find((entry) => entry.name === model)
  const ceiling = current === undefined ? null : ceilingOf(current)
  // The resolved model's own provider is authoritative (covers "no Ollama
  // models installed, GLM auto-selected"); chosen.service covers the frame
  // before either catalog has loaded; 'ollama' is the last-resort default.
  const service: AiService = current?.provider ?? chosen.service ?? 'ollama'
  // Whether the window costs local RAM (Ollama, can become unaffordable
  // later) or is a client-side budget bound only (cloud, N-1-C, DN1C.2) —
  // decides whether conversationWindow ever freezes it.
  const costed = current?.attention !== null

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
  const contextWindow = conversationWindow({ locked, reserved: chosen.numCtx, ceiling, costed })
  const numCtx =
    contextWindow.status === 'open' || contextWindow.status === 'locked'
      ? contextWindow.numCtx
      : null

  const { streaming, lastRequestId, state, send, cancel, lastPrompt } = useConversationChat(
    service,
    model,
    settings.numThread,
    numCtx ?? undefined
  )
  // Reflects whichever service the SELECTED model belongs to, not always
  // Ollama's (N-1-B) — else picking GLM with Ollama down would leave the
  // composer disabled for a reason that has nothing to do with GLM.
  const { state: availability, retry: retryAvailability } = useAiAvailability(service)

  // What the next send would carry: the whole transcript, since the provider
  // is stateless and every turn resends everything. Routed through
  // toChatMessages, not messageText — a dataset part has no text, so summing
  // messageText would count a card's hundreds of chars as zero (D16.5).
  const historyChars = toChatMessages(messages).reduce(
    (total, message) => total + message.content.length,
    0
  )
  // Generic ratio on the first turn, this conversation's own after (the exact
  // count exists only AFTER a call, D15.4). NOT `historyChars`: it already holds
  // the reply the measured call never sent, which cancels the formula (D15.14).
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

  // Header and composer are fixed; only the thread scrolls (D13.5). min-h-[0px]
  // is what lets the middle track shrink instead of pushing the document — the
  // shell already settled that the document itself never scrolls.
  return (
    <section className="flex flex-1 flex-col min-h-[0px]">
      {/* Chrome density (D13.6): the compact fase 05 desktop scale. The top
          toolbar is gone (DS-3 passo 7) — the header is just the conversation
          title now, and the model selector moved into the composer below. A
          title taken from the first message can be long; the header must not grow. */}
      <header className="flex flex-none items-center border-b border-border px-7 py-5">
        <h1 className="overflow-hidden text-md font-semibold whitespace-nowrap text-ellipsis text-text">
          {conversation?.title ?? 'Assistente local'}
        </h1>
      </header>

      {/* The one scrolling surface. Its ref is measured by useStickToBottom, so
          this div must stay the scroll container — swapping the element would
          make the hook watch the wrong node (see HISTORY.md § useStickToBottom). */}
      <div className="flex-1 min-h-[0px] overflow-y-auto p-7" ref={threadRef}>
        {availability.status === 'loading' && (
          <p className={STATUS} role="status">
            Verificando {SERVICE_LABEL[service]}…
          </p>
        )}
        {/* mb-5 moves from the <p> (UNAVAILABLE below) to this row, now that a
            button sits beside the text. */}
        {availability.status === 'error' && (
          <div className="mb-5 flex items-center gap-4">
            <p className="text-sm text-warn-text" role="alert">
              {availabilityText(availability.error)}
            </p>
            <Button variant="secondary" size="sm" onClick={retryAvailability}>
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Under the lock, falling back to the first installed model would have
            the conversation answered by a model its own history never used
            (D15.13). Saying the model is gone is not what the plan defers. */}
        {locked && model === null && chosen.model !== undefined && (
          <p className={UNAVAILABLE} role="alert">
            O modelo <strong>{chosen.model}</strong> desta conversa não está mais instalado. Ela
            fica somente leitura — reinstale o modelo ou comece uma conversa nova.
          </p>
        )}

        {messages.length === 0 && (
          <p className="text-reading text-text-faint">
            Pergunte algo ao modelo para começar uma conversa.
          </p>
        )}

        {messages.length > 0 && (
          <ol className="flex flex-col gap-7">
            {messages.map((message) => {
              const attachment = attachmentPartOf(message)
              return message.role === 'user' ? (
                // User turn: a bubble on the right. Alignment and fill carry the
                // authorship, so the "Você" label the target drops is gone.
                // Reading density (D13.6); select-text opts back into selection
                // that base.css turns off at the root. The dataset card (D16.4
                // Passo 4), when present, is its own element above the bubble —
                // never inlined into the text the model reads.
                <li key={message.id} className="flex flex-col items-end gap-2">
                  {attachment !== null && <AttachmentCard part={attachment} />}
                  <p className="max-w-[80%] rounded-lg bg-surface-raised px-5 py-4 text-reading leading-normal whitespace-pre-wrap text-text select-text">
                    {messageText(message)}
                  </p>
                </li>
              ) : (
                // Assistant turn: plain text on the left, no bubble, no label.
                <li key={message.id} className="flex flex-col gap-2">
                  <MarkdownMessage text={messageText(message)} />
                  {message.stopped !== undefined && (
                    // Why a reply stopped (D14.3). It used to sit beside the author
                    // label the target removed; `stopped` is only ever on an
                    // assistant message, so its home is here, under the text. Warn,
                    // not danger — a cut answer says less, it is not an error.
                    <span className="text-2xs text-warn-text">
                      {STOPPED_LABEL[message.stopped]}
                    </span>
                  )}
                  <TurnActions text={messageText(message)} />
                </li>
              )
            })}
          </ol>
        )}

        {belongsHere && isLoading && streaming !== '' && (
          // whitespace-pre-wrap does NOT belong here (F-1 fixup, item 2): unlike
          // the plain-text user bubble above, MarkdownMessage already turns blank
          // lines into <p> margin — inheriting pre-wrap on top of that renders the
          // source's raw "\n\n" as an extra visual blank line, doubling the gap.
          <div
            className="mt-7 text-reading leading-normal text-text-muted select-text"
            aria-live="polite"
          >
            <MarkdownMessage text={completePartial(streaming)} highlight={false} />
          </div>
        )}
        {belongsHere && state.status === 'error' && (
          <p className={UNAVAILABLE} role="alert">
            {errorMessage(state.error)}
          </p>
        )}
        {belongsHere && state.status === 'cancelled' && (
          <p className={STATUS}>Resposta cancelada.</p>
        )}
      </div>

      {/* Own band, not inside the scrolling thread above — useStickToBottom
          measures that div specifically (D13.5), and this sits outside it. */}
      <ThinkingMark isStreaming={belongsHere && isLoading} />

      {/* No model installed is as blocking as no service — nothing to address
          the call to, so the composer stays closed. A model too large for free
          memory is the third case, explained in the header next to the fix. */}
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
        historyImageCount={imageCountOf(messages)}
        model={current ?? null}
        // A render-prop, not a plain element (DS4.8): `budget` only exists inside
        // Composer (the draft lives there, D13.2), so this function is defined
        // here and only ever CALLED by Composer, at the point `budget` exists.
        // Two pills, not one (DS5.6, item 9) — Composer's prop type never
        // changes, only what this function returns.
        modelSelector={(budget) => (
          <>
            <ModelPicker
              state={catalog}
              cloudModels={cloudModels}
              cloudReadyFor={cloudReadyFor}
              cloudHintFor={cloudHintFor}
              selected={model}
              // Two different reasons to be inert: busy, which passes, and
              // locked, which does not (D15.13).
              disabled={isLoading}
              locked={locked}
              // The picker's own two rows still call onSelect with a bare
              // name (N-1-B, DN1B.7); the service comes from looking it up
              // in allModels here, not from a second callback param.
              onSelect={(name) => {
                const picked = allModels.find((entry) => entry.name === name)
                choose({ model: name, service: picked?.provider ?? 'ollama' })
              }}
              ceilingOf={ceilingOf}
            />
            {/* Button + shape="square" (DS-5 fixup), not a raw <button> with
                hand-picked padding — the hover box now matches every other
                icon-only trigger in the row. size="md" (F-1 fixup, item 3),
                matching AttachButton's paperclip — the two icon-only triggers
                in this row read as the same weight now. Moved ahead of the
                context counter (item 4): clip · model · reload · context. */}
            <Button
              type="button"
              variant="secondary"
              size="md"
              shape="square"
              // Both, because both readings are snapshots the app cannot observe
              // changing: a model installed since launch, and memory freed since.
              onClick={() => {
                reload()
                reloadMemory()
              }}
              // Installing a model is a system event with no notification, so the
              // catalog can only be wrong in one direction — stale. The button is
              // the whole answer to that, which is why it is always available.
              title="Recarregar a lista de modelos"
              aria-label="Recarregar a lista de modelos"
            >
              <RefreshCw size={ICON_SIZE.md} strokeWidth={ICON_STROKE} />
            </Button>
            {catalog.status === 'ready' && (
              <ContextControl
                contextWindow={contextWindow}
                current={current}
                ceiling={ceiling}
                disabled={isLoading}
                locked={locked}
                // Remounts the window control when the conversation changes, so
                // it re-reads that conversation's value instead of showing the
                // last one typed.
                scopeKey={conversation?.id ?? 'sem-conversa'}
                onNumCtx={(tokens) => choose({ numCtx: tokens })}
              />
            )}
            {/* Own row element, last (F-1 fixup, item 4) — out of the
                ContextControl popover it used to hide inside; worth seeing
                without a click, unlike the window-size admin beside it. */}
            <BudgetMeter budget={budget} />
          </>
        )}
      />
    </section>
  )
}

export default ConversationView
