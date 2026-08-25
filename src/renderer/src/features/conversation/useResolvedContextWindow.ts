import type { AiModel } from '@shared/ipc'
import { conversationWindow } from '@core/ai/budget'
import { contextCeiling, RAM_MARGIN_BYTES } from '@core/ai/memory'
import { GEMINI_MODELS, GLM_MODELS } from '@core/ai/models'
import { useSystemMemory } from '../../shared/hooks/useSystemMemory'
import { useAiModels } from './useAiModels'

/**
 * Resolves the context window a conversation would actually send at right
 * now, outside the composer — same ceiling math ConversationView's meter
 * uses (D15.2), so a request built elsewhere (`ai:propose`, D19.7-3) never
 * falls back to Ollama's raw 4096 default just because `settings.numCtx`
 * was never written.
 *
 * @param modelName - `null` when no model is resolved yet; caller must guard.
 * @param storedNumCtx - What the conversation recorded for itself, if any.
 * @param locked - Whether the pair (model, numCtx) is already frozen (D15.13).
 * @returns The window in force, or `undefined` when nothing can be derived
 *   (model not found, or its ceiling makes it too large to run at all).
 */
export function useResolvedContextWindow(input: {
  modelName: string | null
  storedNumCtx: number | undefined
  locked: boolean
}): number | undefined {
  const { modelName, storedNumCtx, locked } = input
  const { state: catalog } = useAiModels('ollama')
  const { memory } = useSystemMemory()

  const installed = catalog.status === 'ready' ? catalog.data : []
  const allModels: AiModel[] = [...installed, ...GLM_MODELS, ...GEMINI_MODELS]
  const current = allModels.find((entry) => entry.name === modelName)

  const ceiling =
    current === undefined
      ? null
      : current.attention === null
        ? current.contextLength
        : memory === undefined
          ? null
          : contextCeiling(current, memory.freeBytes, RAM_MARGIN_BYTES)

  const costed = current?.attention !== null

  const contextWindow = conversationWindow({ locked, reserved: storedNumCtx, ceiling, costed })
  return contextWindow.status === 'open' || contextWindow.status === 'locked'
    ? contextWindow.numCtx
    : undefined
}
