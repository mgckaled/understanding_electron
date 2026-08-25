import type { AiModel, AiModelAttention, LoadedModel } from '@shared/ipc'

/**
 * The pinned catalog for the GLM cloud provider (N-1-B, Peça C) — there is no
 * `/api/show` to sonde, so this is hand-written from `cloud-optin.md`, not
 * derived. `sizeBytes: 0`/`attention: null` are true values, not stand-ins:
 * this model costs no local RAM, and `contextCeiling`/`fitsInMemory` already
 * treat a null `attention` as "uncosted". `'completion'` must stay in
 * `capabilities` — `selectableModels()` (D15.11) filters on it.
 */
export const GLM_MODELS: AiModel[] = [
  {
    provider: 'glm',
    name: 'glm-4.7-flash',
    parameterSize: '31B',
    sizeBytes: 0,
    capabilities: ['completion', 'tools', 'thinking'],
    contextLength: 200_000,
    attention: null,
    variantOf: null,
    // Z.ai publishes concurrency-1, never RPM/TPM/RPD (cloud-optin.md,
    // "terceiro" provenance — the docs.z.ai pricing page does not list it).
    rateLimit: { kind: 'concurrency', max: 1 }
  }
]

/**
 * The pinned catalog for the Gemini cloud provider (N-1-C, Peça C) — same
 * reasoning as `GLM_MODELS`: no `/api/show` to sonde, hand-written from
 * `cloud-optin.md`. Both models are natively multimodal with a configurable
 * `thinkingLevel` (confirmed via Context7 against each model's own doc page,
 * `ai.google.dev/gemini-api/docs/models/<name>`), true for the whole family,
 * not just `gemini-2.5-flash` as the guide originally said.
 */
export const GEMINI_MODELS: AiModel[] = [
  {
    provider: 'gemini',
    name: 'gemini-3.5-flash-lite',
    parameterSize: '',
    sizeBytes: 0,
    capabilities: ['completion', 'tools', 'vision', 'thinking'],
    contextLength: 1_048_576,
    attention: null,
    variantOf: null,
    // Conferido pelo usuário no console do Google AI Studio, 25/08/2026
    // (notes/nuvem/gemini.md) — proveniência "medido", mais forte que os
    // agregadores de terceiro que cloud-optin.md hoje cita.
    rateLimit: { kind: 'rate', rpm: 15, tpm: 250_000, rpd: 500 }
  },
  {
    provider: 'gemini',
    name: 'gemini-3.7-flash',
    parameterSize: '',
    sizeBytes: 0,
    capabilities: ['completion', 'tools', 'vision', 'thinking'],
    contextLength: 1_048_576,
    attention: null,
    variantOf: null,
    rateLimit: { kind: 'rate', rpm: 5, tpm: 250_000, rpd: 20 }
  }
]

// The two raw shapes this module normalizes. Declared loose on purpose: they
// belong to Ollama, not to us, and every field the app depends on is read
// defensively below. A missing field yields null, never a throw — the catalog
// of ten models must not be lost because one of them reports an odd shape.

export type OllamaTag = {
  name: string
  size: number
  details?: {
    parameter_size?: string
    /** Set by `ollama create`; empty string for a model that was pulled. */
    parent_model?: string
  }
}

export type OllamaShow = {
  capabilities?: string[]
  model_info?: Record<string, unknown>
}

/**
 * Reads a numeric `model_info` value by its path BELOW the family prefix. Two
 * traps, both found in real payloads: the family segment is DROPPED, never
 * built from the model name (`mistral:7b` answers under `llama.context_length`);
 * and it must drop exactly one segment, not match by suffix — a vision model
 * carries a parallel `gemma3.vision.block_count` that also ends in
 * `.block_count`, and only dropping one segment is order-independent (D15.8).
 */
function readInfo(info: Record<string, unknown> | undefined, path: string): number | null {
  if (info === undefined) return null
  for (const [key, value] of Object.entries(info)) {
    const firstDot = key.indexOf('.')
    if (firstDot === -1) continue
    if (key.slice(firstDot + 1) !== path) continue
    return typeof value === 'number' ? value : null
  }
  return null
}

// Gemma reports key_length directly; the others leave it implied by
// embedding_length / head_count. Both routes are exact — this is not a
// fallback to a worse estimate, it is two spellings of the same number.
function readHeadDim(info: Record<string, unknown> | undefined): number | null {
  const keyLength = readInfo(info, 'attention.key_length')
  if (keyLength !== null) return keyLength

  const embeddingLength = readInfo(info, 'embedding_length')
  const headCount = readInfo(info, 'attention.head_count')
  if (embeddingLength === null || headCount === null || headCount === 0) return null
  return embeddingLength / headCount
}

function readAttention(info: Record<string, unknown> | undefined): AiModelAttention | null {
  const blockCount = readInfo(info, 'block_count')
  const headCountKv = readInfo(info, 'attention.head_count_kv')
  const headDim = readHeadDim(info)

  // All three are required to cost a context window. An embedder reports none
  // of them, and it is never offered for conversation anyway.
  if (blockCount === null || headCountKv === null || headDim === null) return null

  return {
    blockCount,
    headCountKv,
    headDim,
    // Kept exactly as reported, including values larger than the model's own
    // context ceiling. Deciding whether a window is ACTIVE needs a ceiling to
    // compare against, and that belongs to the budget math, not here.
    slidingWindow: readInfo(info, 'attention.sliding_window')
  }
}

/**
 * Folds one /api/tags entry and its /api/show response into the app's shape.
 * Capabilities come from `show`, never `tag`: /api/tags omits `vision` entirely
 * (gemma3:4b is ["completion"] there, ["completion","vision"] here) while
 * reporting `tools` in both, so a gate built on tags would refuse the only
 * model on this machine that can see.
 */
export function normalizeOllamaModel(tag: OllamaTag, show: OllamaShow): AiModel {
  return {
    provider: 'ollama',
    name: tag.name,
    parameterSize: tag.details?.parameter_size ?? '',
    sizeBytes: tag.size,
    capabilities: show.capabilities ?? [],
    contextLength: readInfo(show.model_info, 'context_length'),
    attention: readAttention(show.model_info),
    // D15.11. Raw parent: whether it is redundant needs the whole catalog, and
    // a variant whose parent is gone is the only way left to run those weights.
    variantOf: tag.details?.parent_model || null
  }
}

/**
 * The one place that answers "can this model do X?". A decision two callers
 * take (plano 17 adds the image gate on both compose and send paths) does not
 * live beside one of them — validation next to a caller becomes a bypass in the
 * second.
 */
export function hasCapability(model: AiModel, capability: string): boolean {
  return model.capabilities.includes(capability)
}

/** One entry of `/api/ps` — what the provider currently holds in memory. */
export type OllamaRunning = {
  name: string
  size: number
  /** RFC 3339 with offset, e.g. '2026-08-11T14:38:31.83-03:00'. */
  expires_at?: string
}

/**
 * `/api/ps` to `LoadedModel`. `size` is the RESIDENT figure — weights plus the
 * loaded window's KV cache — not the disk size `/api/tags` reports, which is
 * why the two never agree. An unparseable `expires_at` becomes 0, not NaN, so
 * absence has the shape of absence instead of poisoning arithmetic.
 */
export function normalizeOllamaRunning(entry: OllamaRunning): LoadedModel {
  const expiresAt = entry.expires_at === undefined ? NaN : Date.parse(entry.expires_at)
  return {
    name: entry.name,
    sizeBytes: entry.size,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0
  }
}
