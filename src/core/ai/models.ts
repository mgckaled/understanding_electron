import type { AiModel, AiModelAttention, LoadedModel } from '@shared/ipc'
import type { ThinkLevel } from './types'

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

/**
 * The free-tier models this app offers from Ollama Cloud (N-3-C, DNC-1/DNC-5).
 * A fixed list, not the whole catalog: `/api/tags` at ollama.com answers with
 * 20 models — 14 of them reply HTTP 402 — and the authenticated catalog is
 * byte-identical to the anonymous one, so nothing in the API tells the paid
 * ones apart. Filtering before the probe also pays the N+1 down to 1 + 1.
 *
 * ⚠️ Bare names, never the `-cloud`/`:cloud` spelling: that suffix belongs to
 * the LOCAL daemon's cloud routing (`ollama run gpt-oss:120b-cloud`), while
 * the REST API answers to the bare name (docs.ollama.com/api/authentication).
 *
 * `gpt-oss:120b` is deliberately absent until N-3-D: it only accepts a
 * reasoning LEVEL, never the boolean this app sends today (DNC-12).
 */
export const OLLAMA_CLOUD_MODEL_NAMES = ['gemma4:31b'] as const

/**
 * Like `normalizeOllamaModel`, but `attention` and `sizeBytes` are FORCED
 * rather than read (DNC-6). Today the cloud reports no attention block at all,
 * so `costed: false` falls out on its own — which is right by ACCIDENT. Were a
 * model to start publishing one, the app would silently budget local RAM for
 * something that uses none; and an inherited `sizeBytes` would show 13,7 GB of
 * disk that does not exist. What IS inherited is the context ceiling and the
 * capabilities — the whole point of probing instead of hand-writing the card.
 */
export function normalizeOllamaCloudModel(tag: OllamaTag, show: OllamaShow): AiModel {
  return {
    ...normalizeOllamaModel(tag, show),
    provider: 'ollama-cloud',
    sizeBytes: 0,
    attention: null
  }
}

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
  const headCount = readInfo(info, 'attention.head_count')
  const fullAttentionInterval = readInfo(info, 'full_attention_interval')
  const headDim = readHeadDim(info)

  // Size and dimension are always required. The head count comes either
  // published or, for a hybrid that reports head_count_kv as literal null
  // (qwen35), derived from head_count — which needs the interval too. Demanding
  // the interval is what keeps an embedder out: nomic-embed publishes
  // head_count and block_count but neither head_count_kv nor an interval
  // (measured, DN3A.9), and costing it would invent a number.
  const heads = headCountKv !== null || (headCount !== null && fullAttentionInterval !== null)
  if (blockCount === null || headDim === null || !heads) return null

  return {
    blockCount,
    headCountKv,
    headCount,
    fullAttentionInterval,
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

/**
 * Whether the UI should offer this model's reasoning, not just whether the
 * model thinks. Gemini's generateContent/streamGenerateContent has no
 * dedicated thought block at all — confirmed against the Interactions API
 * docs (21-C-C) — so `capabilities` stays true (the model does think;
 * `thinkingLevel` has no real off switch, D21A.6), and this is the separate
 * question of what this app's current adapter can actually show.
 */
// Gemini exclusion (D21C.10) reverted in D21D.4/D21D.10: the Interactions
// API (21-D-A) returns a real `reasoning` string, same shape Ollama/GLM have
// had since 21-A — nothing here needs the signature resend that 21-D-B adds.
export function exposesReasoning(model: AiModel): boolean {
  return hasCapability(model, 'thinking')
}

/**
 * Drops a variant whose parent is also present in `models` (D15.11) — a
 * Modelfile clone made for a sibling app (mill.tools) sharing this Ollama, not
 * a second install. Keeps a variant when its parent is absent, since it is
 * then the only way left to run those weights.
 */
export function dropRedundantVariants(models: AiModel[]): AiModel[] {
  const installed = new Set(models.map((model) => model.name))
  return models.filter((model) => model.variantOf === null || !installed.has(model.variantOf))
}

/**
 * Whether this local-catalog name is really routed to Ollama's cloud, which
 * `ollama signin` publishes into /api/tags like any installed model. It would
 * arrive under `provider: 'ollama'`, and `isCloudService` reads that as local —
 * so data, images included, would leave the machine with no privacy-ledger row
 * (DN3A.3). The switch belongs to the user's server.json, never to this app, so
 * the catalog is outside input and the drop happens here.
 *
 * Both spellings are in circulation: the docs show `gpt-oss:120b-cloud`, the
 * newer catalog uses `qwen3.5:cloud`. Matching only one leaves the silent hole
 * this guard exists to close, and neither is verifiable from a machine that
 * never signed in.
 */
export function isCloudRoutedName(name: string): boolean {
  return /[-:]cloud$/.test(name)
}

/**
 * The level a model requires instead of the boolean, or null (DN3D.2). Read by
 * NAME: `capabilities` reports only `thinking`, and gpt-oss ignores `true`/`false`.
 * `'low'` is the floor, never an off switch — that family cannot disable it.
 */
export function requiredThinkLevel(name: string): ThinkLevel | null {
  return /^gpt-oss(:|$)/.test(name) ? 'low' : null
}

/** Models the catalog declares `embedding` for (O-4, DO4.5) — takes whatever catalog the caller passes; it is the caller's job to have already dropped redundant variants (`dropRedundantVariants`), not this function's. */
export function findEmbedders(models: AiModel[]): AiModel[] {
  return models.filter((model) => hasCapability(model, 'embedding'))
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
