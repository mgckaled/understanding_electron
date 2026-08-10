import type { AiModel, AiModelAttention } from '@shared/ipc'

// The two raw shapes this module normalizes. Declared loose on purpose: they
// belong to Ollama, not to us, and every field the app depends on is read
// defensively below. A missing field yields null, never a throw — the catalog
// of ten models must not be lost because one of them reports an odd shape.

export type OllamaTag = {
  name: string
  size: number
  details?: { parameter_size?: string }
}

export type OllamaShow = {
  capabilities?: string[]
  model_info?: Record<string, unknown>
}

/**
 * Reads a numeric `model_info` value by its path BELOW the family prefix.
 *
 * Two traps live in this one function, and both were found in real payloads.
 *
 * 1. The prefix is not derivable from the model name. `mistral:7b` answers
 *    under `llama.context_length`, which it shares with `llama3.1:8b` — the
 *    family segment is DROPPED, never constructed from the name.
 *
 * 2. Matching by suffix, which is the obvious way to drop it, is correct only
 *    by luck. A vision model carries a second, parallel namespace —
 *    `gemma3.block_count` is 34, `gemma3.vision.block_count` is 27, and both
 *    end in `.block_count`. Ollama happens to return model_info sorted, and
 *    `vision` happens to sort after `attention`, `block_count` and
 *    `embedding_length`, so first-match-wins gets the right answer today. A
 *    sub-namespace sorting EARLIER would not be so kind: an `audio.*` tower
 *    would shadow `block_count`. Dropping exactly one segment removes the
 *    dependency on key order entirely — `vision.block_count` is not
 *    `block_count`, whatever the order.
 *
 * Considered and not taken: reading `general.architecture` (which reports
 * `gemma3`, `llama`, `phi3`) and building the key from it. That would be
 * authoritative rather than guessing, and it works — it just needs one more
 * field to be present, and buys nothing this does not already give.
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
 *
 * Capabilities come from `show` and never from `tag`, which is not a
 * preference: /api/tags omits `vision` entirely — gemma3:4b appears there as
 * ["completion"] and here as ["completion","vision"] — while reporting `tools`
 * correctly in both, which is what makes the trap convincing. A gate built on
 * the tags list would refuse the only model on this machine that can see.
 */
export function normalizeOllamaModel(tag: OllamaTag, show: OllamaShow): AiModel {
  return {
    provider: 'ollama',
    name: tag.name,
    parameterSize: tag.details?.parameter_size ?? '',
    sizeBytes: tag.size,
    capabilities: show.capabilities ?? [],
    contextLength: readInfo(show.model_info, 'context_length'),
    attention: readAttention(show.model_info)
  }
}

/**
 * The one place that answers "can this model do X?".
 *
 * It exists with a single caller today and will have two in plano 17 (the
 * image gate, on both the compose and the send path). A decision two callers
 * have to take does not live beside one of them — validation placed next to a
 * caller becomes a bypass in the second.
 */
export function hasCapability(model: AiModel, capability: string): boolean {
  return model.capabilities.includes(capability)
}
