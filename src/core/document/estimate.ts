import { DEFAULT_CHARS_PER_TOKEN } from '../ai/budget'

/** Text prefill on the dev machine's CPU (docs/ESCOPO.md § o anexo custa segundos de prefill): 25–29 tokens/s, this is the midpoint. */
const PREFILL_TOKENS_PER_SECOND = 27

/**
 * Rough seconds to read a document of `sizeBytes`, shown in the progress
 * label before the job starts (D17.10) — bytes ÷ chars-per-token ÷ prefill
 * rate. Always at least 1: a sub-second estimate would read as "instant" and
 * then visibly not be.
 */
export function estimateReadSeconds(sizeBytes: number): number {
  const tokens = sizeBytes / DEFAULT_CHARS_PER_TOKEN
  return Math.max(1, Math.round(tokens / PREFILL_TOKENS_PER_SECOND))
}
