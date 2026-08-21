import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DuckDBInstance } from '@duckdb/node-api'
import { ensureDatasetView } from '@core/duckdb/query'

// A real 64-char hex digest — attachments live at `attachmentsDir/<hash>`,
// no extension (D16.3), so the fixture is written under this exact name.
const HASH = 'a'.repeat(64)

// A Latin-1/Windows-1252 CSV, the shape a Brazilian spreadsheet export
// produces — "José"/"São Paulo" written as raw ISO-8859-1 bytes, which is
// invalid UTF-8 and what real-DuckDB rejects on the plain (utf-8) attempt.
async function writeLatin1Fixture(attachmentsDir: string): Promise<void> {
  const header = 'cliente_id;nome;cidade'
  const row = Buffer.concat([
    Buffer.from('1;', 'ascii'),
    Buffer.from('José da Silva', 'latin1'),
    Buffer.from(';', 'ascii'),
    Buffer.from('São Paulo', 'latin1')
  ])
  const content = Buffer.concat([Buffer.from(header + '\n', 'ascii'), row, Buffer.from('\n')])
  await writeFile(join(attachmentsDir, HASH), content)
}

describe('ensureDatasetView against a real, non-UTF-8 CSV (HISTORY.md § Correção pós-18-C)', () => {
  it('falls back to latin-1 and decodes the accented columns correctly', async () => {
    const attachmentsDir = await mkdtemp(join(tmpdir(), 'crivo-encoding-fallback-'))
    try {
      await writeLatin1Fixture(attachmentsDir)
      const instance = await DuckDBInstance.create(':memory:')
      const connection = await instance.connect()

      const encoding = await ensureDatasetView({
        hash: HASH,
        attachmentsDir,
        format: 'delimited',
        knownEncoding: undefined,
        run: (sql) => connection.run(sql)
      })

      expect(encoding).toBe('latin-1')

      const reader = await connection.runAndReadAll('SELECT * FROM dataset')
      const columns = reader.getColumnsObject()
      expect(columns.nome).toEqual(['José da Silva'])
      expect(columns.cidade).toEqual(['São Paulo'])
    } finally {
      await rm(attachmentsDir, { recursive: true, force: true })
    }
  })

  it('a genuinely unreadable file still fails, with the original utf-8 error', async () => {
    const attachmentsDir = await mkdtemp(join(tmpdir(), 'crivo-encoding-fallback-'))
    try {
      // 0x93/0x94 are valid cp1252 (curly quotes) but rejected by DuckDB's own
      // latin-1 decoder (measured) — neither built-in encoding reads this file.
      await writeFile(
        join(attachmentsDir, HASH),
        Buffer.concat([
          Buffer.from('id;nome\n1;', 'ascii'),
          Buffer.from([0x93]),
          Buffer.from('Ana', 'ascii'),
          Buffer.from([0x94]),
          Buffer.from('\n', 'ascii')
        ])
      )
      const instance = await DuckDBInstance.create(':memory:')
      const connection = await instance.connect()

      await expect(
        ensureDatasetView({
          hash: HASH,
          attachmentsDir,
          format: 'delimited',
          knownEncoding: undefined,
          run: (sql) => connection.run(sql)
        })
      ).rejects.toThrow(/not utf-8 encoded/i)
    } finally {
      await rm(attachmentsDir, { recursive: true, force: true })
    }
  })
})
