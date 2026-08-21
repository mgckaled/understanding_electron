import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DuckDBInstance } from '@duckdb/node-api'
import { tableFromIPC } from 'apache-arrow'
import { ensureDatasetView } from '@core/duckdb/query'
import { buildDescribeSql, hasNestedType } from '@core/duckdb/schema'
import { buildCountSql } from '@core/duckdb/profile'
import { columnsToArrowBytes } from '@core/duckdb/arrow'
import { normalizeColumns } from './normalizeColumns'

// A real 64-char hex digest — attachments live at `attachmentsDir/<hash>`,
// no extension (D16.3).
const HASH = 'a'.repeat(64)

async function withAttachedJson(
  content: string,
  run: (connection: import('@duckdb/node-api').DuckDBConnection) => Promise<void>
): Promise<void> {
  const attachmentsDir = await mkdtemp(join(tmpdir(), 'crivo-json-schema-'))
  try {
    await writeFile(join(attachmentsDir, HASH), content, 'utf8')
    const instance = await DuckDBInstance.create(':memory:')
    const connection = await instance.connect()

    await ensureDatasetView({
      hash: HASH,
      attachmentsDir,
      format: 'json',
      knownEncoding: undefined,
      run: (sql) => connection.run(sql)
    })

    await run(connection)
  } finally {
    await rm(attachmentsDir, { recursive: true, force: true })
  }
}

describe('DESCRIBE against a real read_json_auto view (D18E.3/D18E.4)', () => {
  it('reports flat NDJSON columns with no nested type', async () => {
    const ndjson = [
      '{"id": 1, "nome": "Ana", "criado_em": "2026-08-21T10:30:00", "ativo": true}',
      '{"id": 2, "nome": "Bruno", "criado_em": "2026-08-20T09:00:00", "ativo": false}'
    ].join('\n')

    await withAttachedJson(ndjson, async (connection) => {
      const describeReader = await connection.runAndReadAll(buildDescribeSql('dataset'))
      const rows = describeReader.getRowObjectsJS() as {
        column_name: unknown
        column_type: unknown
      }[]

      expect(rows.map((row) => String(row.column_name))).toEqual([
        'id',
        'nome',
        'criado_em',
        'ativo'
      ])
      expect(rows.some((row) => hasNestedType(String(row.column_type)))).toBe(false)

      const countReader = await connection.runAndReadAll(buildCountSql('dataset'))
      const [countRow] = countReader.getRowObjectsJS() as [{ row_count: bigint | number }]
      expect(Number(countRow.row_count)).toBe(2)
    })
  })

  // The gap normalizeColumns.ts (D18B) had until this plan (D18E.6): it only
  // unwrapped DuckDBDateValue, and a TIMESTAMP column — real for a JSON
  // attach's ISO datetime, never produced by the CSV path — would have sailed
  // through as an opaque DuckDBTimestampValue into tableFromArrays. Exercises
  // the whole query path (getColumnsObject → normalizeColumns →
  // columnsToArrowBytes → tableFromIPC), iterating the vector rather than
  // `.toArray()` (18-B armadilha: the latter silently reads null as 0).
  it('round-trips a TIMESTAMP column from an ISO datetime through the real query path', async () => {
    const ndjson = '{"id": 1, "criado_em": "2026-08-21T10:30:00"}\n'

    await withAttachedJson(ndjson, async (connection) => {
      const reader = await connection.runAndReadAll('SELECT * FROM dataset')
      const bytes = columnsToArrowBytes(normalizeColumns(reader.getColumnsObject()))
      const table = tableFromIPC(bytes)
      const vector = table.getChild('criado_em')
      if (!vector) throw new Error('missing column: criado_em')

      // Arrow gives back millis-since-epoch on read for a Date it stored
      // (same as the DATE round-trip in arrow.test.ts), not a Date instance.
      expect([...vector]).toEqual([Date.UTC(2026, 7, 21, 10, 30, 0)])
    })
  })

  it('flags a nested object column', async () => {
    const ndjson = ['{"id": 1, "endereco": {"cidade": "SP", "cep": "01000-000"}}'].join('\n')

    await withAttachedJson(ndjson, async (connection) => {
      const describeReader = await connection.runAndReadAll(buildDescribeSql('dataset'))
      const rows = describeReader.getRowObjectsJS() as {
        column_name: unknown
        column_type: unknown
      }[]

      const nested = rows.find((row) => hasNestedType(String(row.column_type)))
      expect(nested?.column_name).toBe('endereco')
      expect(String(nested?.column_type)).toMatch(/^STRUCT\(/)
    })
  })

  it('flags a nested list column', async () => {
    const ndjson = ['{"id": 1, "tags": ["a", "b", "c"]}'].join('\n')

    await withAttachedJson(ndjson, async (connection) => {
      const describeReader = await connection.runAndReadAll(buildDescribeSql('dataset'))
      const rows = describeReader.getRowObjectsJS() as {
        column_name: unknown
        column_type: unknown
      }[]

      const nested = rows.find((row) => hasNestedType(String(row.column_type)))
      expect(nested?.column_name).toBe('tags')
    })
  })

  // Closes the plan's Risco 3 with a measurement instead of a guess: a field
  // whose type disagrees row to row — never produces STRUCT/MAP/LIST, but
  // read_json_auto's own escape hatch, the exact type JSON (advisor finding).
  it('flags an inconsistent-schema column typed JSON, even when one row is a nested object', async () => {
    const ndjson = ['{"id": 1, "campo": 25}', '{"id": 2, "campo": {"a": 1}}'].join('\n')

    await withAttachedJson(ndjson, async (connection) => {
      const describeReader = await connection.runAndReadAll(buildDescribeSql('dataset'))
      const rows = describeReader.getRowObjectsJS() as {
        column_name: unknown
        column_type: unknown
      }[]

      const nested = rows.find((row) => hasNestedType(String(row.column_type)))
      expect(nested?.column_name).toBe('campo')
      expect(String(nested?.column_type)).toBe('JSON')
    })
  })
})
