/**
 * Bytes as gigabytes with one decimal and a comma, the pt-BR form: 3_338_801_804
 * → "3,1 GB". Binary gigabytes: both things measured this way — model
 * weights and machine memory — are reported that way by Ollama and by Windows.
 */
export function formatSize(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`
}
