import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { AiModel, AiService, AppError, ConversationSettings } from '@shared/ipc'
import { historyCharsOf, imageCountOf } from '@core/ai/messages'
import { conversationWindow } from '@core/ai/budget'
import { contextCeiling, RAM_MARGIN_BYTES } from '@core/ai/memory'
import { errorMessage } from '../../shared/ui/messages'
import Button from '../../shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import MarkdownMessage from '../../shared/ui/MarkdownMessage/MarkdownMessage'
import { useSystemMemory } from '../../shared/hooks/useSystemMemory'
import { SERVICE_LABEL } from '../../shared/serviceLabel'
import { useSettings } from '../settings/settingsContext'
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
import RespondingMark from './RespondingMark'
import ReasoningDisclosure from './ReasoningDisclosure'
import ArtifactCount from '../artifact/ArtifactCount'
import DraftCount from '../draft/DraftCount'
import MessageList from './MessageList'
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

  const {
    streaming,
    streamingReasoning,
    lastRequestId,
    state,
    send,
    cancel,
    charsPerToken,
    anchor
  } = useConversationChat(service, model, settings.numThread, numCtx ?? undefined)
  const thinking = streamingReasoning !== '' && streaming === ''
  const phase: 'connecting' | 'thinking' | 'responding' =
    streaming !== '' ? 'responding' : thinking ? 'thinking' : 'connecting'
  // Reflects whichever service the SELECTED model belongs to, not always
  // Ollama's (N-1-B) — else picking GLM with Ollama down would leave the
  // composer disabled for a reason that has nothing to do with GLM.
  const { state: availability, retry: retryAvailability } = useAiAvailability(service)

  // What the next send would carry: the whole transcript, since the provider
  // is stateless and every turn resends everything. Routed through
  // historyCharsOf, not messageText — a dataset part has no text, so summing
  // messageText would count a card's hundreds of chars as zero (D16.5).
  const historyChars = historyCharsOf(messages)
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
        <h1 className="min-w-[0px] overflow-hidden text-md font-semibold whitespace-nowrap text-ellipsis text-text">
          {conversation?.title ?? 'Assistente local'}
        </h1>
        {/* Opposite end from the title, which truncates rather than pushing it
            (DF3B.1). `min-w-[0px]` on the <h1> is what makes the truncation win
            over the clip instead of the other way round. */}
        <div className="ml-auto flex flex-none items-center gap-1">
          <DraftCount />
          <ArtifactCount />
        </div>
      </header>

      {/* The one scrolling surface. Its ref is measured by useStickToBottom, so
          this div must stay the scroll container — swapping the element would
          make the hook watch the wrong node (see HISTORY.md § useStickToBottom). */}
      <div className="flex-1 min-h-[0px] overflow-y-auto p-7" ref={threadRef}>
        {availability.status === 'loading' && (
          <p className={STATUS} role="status">
            Verificando o {SERVICE_LABEL[service]}…
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

        {messages.length > 0 && <MessageList messages={messages} service={service} />}

        {belongsHere && isLoading && streamingReasoning !== '' && (
          <div className="mt-7">
            <ReasoningDisclosure text={streamingReasoning} provider={service} thinking={thinking} />
          </div>
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
      <RespondingMark isStreaming={belongsHere && isLoading} phase={phase} />

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
        costed={costed}
        anchor={anchor}
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
