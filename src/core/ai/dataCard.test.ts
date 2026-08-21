import type { DatasetPart } from '@shared/ipc'
import { scanDelimited } from '../dataset/scan'
import { formatDataCard } from './dataCard'

function datasetPart(overrides: Partial<DatasetPart> = {}): DatasetPart {
  return {
    kind: 'dataset',
    hash: 'abc123',
    fileName: 'vendas.csv',
    format: 'delimited',
    delimiter: ',',
    columns: ['id', 'valor'],
    rowCount: 10,
    ...overrides
  }
}

describe('formatDataCard', () => {
  it('includes the file name, column list and row count', () => {
    const card = formatDataCard(
      datasetPart({ fileName: 'vendas.csv', columns: ['id', 'valor'], rowCount: 10 })
    )

    expect(card).toContain('vendas.csv')
    expect(card).toContain('id, valor')
    expect(card).toContain('10')
  })

  it('never leaks a row value — level 1 is schema plus row count only (D16.4)', async () => {
    const SENTINEL = 'SENTINEL_ROW_VALUE_4f8a'
    async function* fixtureLines(): AsyncGenerator<string> {
      yield 'id,nome,observacao'
      yield `1,Ana,${SENTINEL}`
      yield '2,Bruno,tudo bem'
    }

    const scanned = await scanDelimited({ lines: fixtureLines() })
    if (!scanned.ok) throw new Error('fixture scan failed')
    const card = formatDataCard({
      kind: 'dataset',
      hash: 'h',
      fileName: 'f.csv',
      format: 'delimited',
      ...scanned.value
    })

    expect(card).not.toContain(SENTINEL)
    expect(card).toContain('observacao') // the column NAME is allowed — only the cell is not
  })

  // D18E — a JSON part carries no delimiter at all (schema field is
  // optional). Guards against the card ever growing a `delimiter` line: it
  // would compile clean and print the literal text "undefined".
  it('renders a JSON part with no delimiter field, the same shape as delimited', () => {
    const card = formatDataCard(
      datasetPart({ fileName: 'vendas.json', format: 'json', delimiter: undefined })
    )

    expect(card).not.toContain('undefined')
    expect(card).toContain('vendas.json')
  })
})
