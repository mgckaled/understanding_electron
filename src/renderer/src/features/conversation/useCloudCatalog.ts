import type { AiModel, AiService } from '@shared/ipc'
import { GEMINI_MODELS, GLM_MODELS } from '@core/ai/models'
import { useCloudSecret } from '../settings/useCloudSecret'

// Split out of ConversationView.tsx once that file crossed the design
// system's 400-line cap (N-1-C, passo 7) — the same reason ModelPicker and
// ContextControl were split out earlier (F2.7).

const GLM_HINT = 'Configure a chave da Z.ai em Configurações para usar o GLM.'
const GEMINI_HINT = 'Configure a chave do Google AI Studio em Configurações para usar o Gemini.'

export type CloudCatalog = {
  cloudModels: AiModel[]
  /** Whether each provider's key is stored (Peça 9) — gates the click, never the row's visibility. */
  cloudReadyFor: Partial<Record<AiService, boolean>>
  /** The same hint `ai:isAvailable` returns per provider, shown when that provider's key is missing. */
  cloudHintFor: Partial<Record<AiService, string | undefined>>
}

/**
 * Pinned tables (Peça C), not a fetch — GLM_MODELS/GEMINI_MODELS are the same
 * constants core/ai/models.ts already gives the main process, imported
 * directly instead of round-tripping through ai:models for data that never
 * changes at runtime (N-1-B, N-1-C). Two independent `useCloudSecret` calls,
 * not one map-shaped hook: each provider's key is its own row in `secrets`.
 */
export function useCloudCatalog(): CloudCatalog {
  const { hasKey: glmReady } = useCloudSecret('glm')
  const { hasKey: geminiReady } = useCloudSecret('gemini')

  return {
    cloudModels: [...GLM_MODELS, ...GEMINI_MODELS],
    cloudReadyFor: { glm: glmReady, gemini: geminiReady },
    cloudHintFor: {
      glm: glmReady ? undefined : GLM_HINT,
      gemini: geminiReady ? undefined : GEMINI_HINT
    }
  }
}
