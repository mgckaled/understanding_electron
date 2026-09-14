import type { AiModel, AiService } from '@shared/ipc'
import { GEMINI_MODELS, GLM_MODELS } from '@core/ai/models'
import { useCloudSecret } from '../settings/useCloudSecret'
import { useAiModels } from './useAiModels'

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
 * Pinned tables (Peça C) for GLM and Gemini — the same constants
 * core/ai/models.ts gives the main process, imported directly instead of
 * round-tripping through ai:models for data that never changes at runtime
 * (N-1-B, N-1-C). One `useCloudSecret` per provider, not one map-shaped hook:
 * each provider's key is its own row in `secrets`.
 *
 * ⚠️ Ollama Cloud is the exception, and the difference is deliberate: its
 * catalog is PROBED, so its rows only exist once a key is stored (DN3C.7).
 * Without one there is no row at all — not the disabled-row-with-a-hint the
 * other two get, because that convention presumes a catalog that costs
 * nothing, and this one is a network call nobody opted into. Discovery happens
 * in Configurações, where every provider is discovered. Belt and braces: the
 * adapter itself throws before any fetch when the vault is empty.
 */
export function useCloudCatalog(): CloudCatalog {
  const { hasKey: glmReady } = useCloudSecret('glm')
  const { hasKey: geminiReady } = useCloudSecret('gemini')
  const { hasKey: ollamaCloudReady } = useCloudSecret('ollama-cloud')
  const { state: ollamaCloudState } = useAiModels('ollama-cloud', ollamaCloudReady)
  const ollamaCloudModels = ollamaCloudState.status === 'ready' ? ollamaCloudState.data : []

  return {
    cloudModels: [...GLM_MODELS, ...GEMINI_MODELS, ...ollamaCloudModels],
    // No hint for 'ollama-cloud': its rows only exist when the key already
    // does, so a "configure a key" hint could never be on screen.
    cloudReadyFor: { glm: glmReady, gemini: geminiReady, 'ollama-cloud': ollamaCloudReady },
    cloudHintFor: {
      glm: glmReady ? undefined : GLM_HINT,
      gemini: geminiReady ? undefined : GEMINI_HINT
    }
  }
}
