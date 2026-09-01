/**
 * Bytes as gigabytes with one decimal and a comma, the pt-BR form: 3_338_801_804
 * → "3,1 GB". Binary gigabytes: both things measured this way — model
 * weights and machine memory — are reported that way by Ollama and by Windows.
 */
export function formatSize(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const

/**
 * Bytes with the unit picked by magnitude — B/KB/MB/GB, pt-BR comma. Unlike
 * {@link formatSize}, which fixes GB for values that are always large
 * (memory, model weights) and stay comparable that way, this is for values
 * that are often small (extension memory tags, database file size), where a
 * fixed GB scale would round everything down to "0,0 GB".
 */
export function formatBytes(bytes: number): string {
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024
    unitIndex++
  }
  const decimals = unitIndex === 0 ? 0 : 1
  return `${value.toFixed(decimals).replace('.', ',')} ${BYTE_UNITS[unitIndex]}`
}
