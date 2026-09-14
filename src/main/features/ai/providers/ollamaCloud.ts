import type { LoadedFn, ModelsFn, ProbeFn, UnloadFn, ChatFn } from '@core/ai/types'
import { UpstreamError } from '@core/ai/types'
import { normalizeOllamaCloudModel, OLLAMA_CLOUD_MODEL_NAMES } from '@core/ai/models'
import { makeOllamaChat, makeOllamaModels, type OllamaTarget } from './ollama'

// The same endpoints the local daemon serves, under a host that authenticates
// (docs.ollama.com/api/authentication). Everything about the wire is shared
// with ollama.ts by parametrisation, never by a second copy (DNC-10).
const OLLAMA_CLOUD_HOST = 'https://ollama.com'

const ALLOWED = new Set<string>(OLLAMA_CLOUD_MODEL_NAMES)

function targetFor(getApiKey: () => string | null): OllamaTarget {
  return {
    baseUrl: OLLAMA_CLOUD_HOST,
    label: 'ollama-cloud',
    headers: () => {
      const apiKey = getApiKey()
      if (apiKey === null) throw new UpstreamError(null, 'no api key stored')
      return { authorization: `Bearer ${apiKey}` }
    },
    // The fixed list, applied before an /api/show is spent on a tag. Never the
    // local target's `-cloud` filter, which would drop what is wanted here.
    keepTag: (name) => ALLOWED.has(name),
    normalize: normalizeOllamaCloudModel
  }
}

export function makeOllamaCloudChat(getApiKey: () => string | null): ChatFn {
  return makeOllamaChat(targetFor(getApiKey))
}

export function makeOllamaCloudModels(getApiKey: () => string | null): ModelsFn {
  return makeOllamaModels(targetFor(getApiKey))
}

/**
 * "Available" means "there is a key stored", never a real ping.
 *
 * ⚠️ Here that rule holds DESPITE a ping being possible, not because it is
 * impossible as with Gemini/GLM: `/api/version` at ollama.com answers 200 with
 * no credential at all (DNC-7), so a ping would only prove the internet is up.
 * Without this note the next reader "fixes" it into a real ping and the status
 * card starts lying.
 */
export function makeOllamaCloudProbe(hasKey: () => boolean): ProbeFn {
  return async () => {
    if (!hasKey()) throw new UpstreamError(null, 'no api key stored')
    return 'cloud'
  }
}

/** `/api/ps` answers 401 here — a true answer, not a missing feature (DNC-11). */
export const ollamaCloudLoaded: LoadedFn = async () => []
export const ollamaCloudUnload: UnloadFn = async () => {}
