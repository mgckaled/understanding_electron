import type { DatasetPart } from '@shared/ipc'

// The data card (D16.4): the description of an attached file the MODEL reads —
// column names and row count, never a row. Deterministic and model-free, the
// same part always formats to the same text, which is the point: asking a
// model to summarize would need the rows to do it, defeating the boundary this
// exists to hold. Level 1 today; plano 18's SUMMARIZE fills level 2 into the
// same shape, not a second one.

/** The text a dataset attachment contributes to the model's prompt. */
export function formatDataCard(part: DatasetPart): string {
  return [
    `[Arquivo anexado: ${part.fileName}]`,
    `Colunas (${part.columns.length}): ${part.columns.join(', ')}`,
    `Linhas: ${part.rowCount}`
  ].join('\n')
}
