import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DuckDBInstance } from '@duckdb/node-api'
import { scanDelimited } from '@core/dataset/scan'

// D18C.7 / plano 18-C passo 4: scanDelimited (what DatasetCard's chrome
// counts) and read_csv_auto (what DatasetPreview renders) are two
// independent sniffers over the same bytes. A ';'-delimited file with one
// quoted field holding a ',' is exactly the shape that could make them
// disagree — and passo 4 treats a divergence here as a defect to
// investigate, not "confuso mas aceitável" to wave through.
const AMBIGUOUS_CSV = ['id;nome;endereco', '1;"Ana, Silva";Rua A', '2;"Bruno, Souza";Rua B'].join(
  '\n'
)

async function* linesOf(text: string): AsyncGenerator<string> {
  for (const line of text.split('\n')) yield line
}

describe('scanDelimited vs read_csv_auto column agreement', () => {
  // A bare DuckDBInstance, not the app's configured engine
  // (buildDuckDbStartupCommands) — this asks only whether the two sniffers
  // agree on column names, not whether the restricted engine still allows
  // reading the fixture's tmpdir path.
  it('detect the same columns for a semicolon CSV with a quoted comma', async () => {
    const summary = await scanDelimited({ lines: linesOf(AMBIGUOUS_CSV) })
    if (!summary.ok) throw new Error('scanDelimited failed')

    const dir = await mkdtemp(join(tmpdir(), 'crivo-18c-'))
    const path = join(dir, 'ambiguous.csv')
    await writeFile(path, AMBIGUOUS_CSV, 'utf8')

    try {
      const instance = await DuckDBInstance.create(':memory:')
      const connection = await instance.connect()
      const reader = await connection.runAndReadAll(
        `SELECT * FROM read_csv_auto('${path.replace(/\\/g, '/')}')`
      )
      const engineColumns = Object.keys(reader.getColumnsObject())

      expect(engineColumns).toEqual(summary.value.columns)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
