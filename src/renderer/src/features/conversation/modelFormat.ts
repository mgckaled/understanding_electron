import type { CloudRateLimit } from '@shared/ipc'

// Shared by ModelPicker and ContextControl (F2.7) — the two pills split by
// concern into separate modules once ModelSelector.tsx crossed the design
// system's line-count ceiling, but both still format the same two numbers.

export function formatSize(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`
}

/**
 * 131072 → "128k", 32768 → "32k". Binary thousands — what the number is and how
 * model cards write it; the order of magnitude is the decision, not the digits.
 */
export function formatContext(tokens: number | null): string | null {
  return tokens === null ? null : `${Math.round(tokens / 1024)}k`
}

/**
 * TPM is a round decimal number (250.000), not a power of 1024 like
 * `contextLength` — reusing `formatContext`'s binary-thousands math here
 * would read "244k" instead of "250k" (N-1-C, DN1C.4).
 */
export function formatRateLimit(limit: CloudRateLimit): string {
  return limit.kind === 'concurrency'
    ? `${limit.max} simultânea${limit.max === 1 ? '' : 's'}`
    : `${limit.rpm} RPM · ${Math.round(limit.tpm / 1000)}k TPM · ${limit.rpd} RPD`
}
