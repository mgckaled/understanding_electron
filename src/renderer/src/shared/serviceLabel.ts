import type { AiService } from '@shared/ipc'

export const SERVICE_LABEL: Record<AiService, string> = {
  ollama: 'Ollama',
  glm: 'GLM (Z.ai)',
  gemini: 'Gemini (Google)'
}
