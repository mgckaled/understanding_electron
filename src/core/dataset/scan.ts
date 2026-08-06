import type { DatasetSummary, Result } from '@shared/ipc'
import { ok, err } from '../result'

const CANDIDATE_DELIMITERS = [',', ';', '\t', '|'] as const
const DEFAULT_DELIMITER = ','
const SAMPLE_SIZE = 10

function countFields(line: string, delimiter: string): number {
  let count = 1
  let inQuotes = false
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === delimiter && !inQuotes) {
      count++
    }
  }
  return count
}

function detectDelimiter(sampleLines: string[]): string {
  let best = { delimiter: DEFAULT_DELIMITER, score: 0 }

  for (const delimiter of CANDIDATE_DELIMITERS) {
    const counts = sampleLines.map((line) => countFields(line, delimiter))
    const isConsistent = counts.every((count) => count === counts[0])
    const score = isConsistent && counts[0] > 1 ? counts[0] : 0
    if (score > best.score) {
      best = { delimiter, score }
    }
  }

  return best.delimiter
}

function splitDelimited(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === delimiter && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)

  return fields
}

export async function scanDelimited(input: {
  lines: AsyncIterable<string>
  onProgress?: (rows: number) => void
  signal?: AbortSignal
}): Promise<Result<DatasetSummary>> {
  if (input.signal?.aborted) return err({ kind: 'cancelled' })

  let headerLine: string | null = null
  let rowCount = 0
  const sample: string[] = []

  for await (const line of input.lines) {
    if (input.signal?.aborted) return err({ kind: 'cancelled' })

    if (headerLine === null) {
      headerLine = line
      sample.push(line)
      continue
    }

    rowCount++
    if (sample.length < SAMPLE_SIZE) sample.push(line)
    input.onProgress?.(rowCount)
  }

  if (headerLine === null) {
    return ok({ delimiter: DEFAULT_DELIMITER, columns: [], rowCount: 0 })
  }

  const delimiter = detectDelimiter(sample)
  const columns = splitDelimited(headerLine, delimiter)

  return ok({ delimiter, columns, rowCount })
}
