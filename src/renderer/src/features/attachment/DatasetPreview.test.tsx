import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { DatasetPart } from '@shared/ipc'
import { columnsToArrowBytes } from '@core/duckdb/arrow'
import { installApiMock } from '@test/api-mock'
import { createQueryClient } from '../../shared/queryClient'
import DatasetPreview from './DatasetPreview'

const PART: DatasetPart = {
  kind: 'dataset',
  hash: 'h1',
  fileName: 'clientes.csv',
  format: 'delimited',
  delimiter: ',',
  columns: ['id', 'nome'],
  rowCount: 10
}

function mount(part: DatasetPart = PART): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <DatasetPreview part={part} />
    </QueryClientProvider>
  )
}

describe('DatasetPreview', () => {
  it('shows a loading status while the query is pending', () => {
    const api = installApiMock()
    vi.mocked(api.dataset.query).mockReturnValue(new Promise(() => {}))

    mount()

    expect(screen.getByRole('status')).toHaveTextContent('Carregando pré-visualização…')
  })

  it('shows the engine error text as an alert', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.query).mockResolvedValue({
      ok: false,
      error: { kind: 'invalidQuery', message: 'Binder Error: column "x" not found' }
    })

    mount()

    expect(await screen.findByRole('alert')).toHaveTextContent('Binder Error: column "x" not found')
  })

  it('renders a text, not an empty table, for a header-only file', async () => {
    const api = installApiMock()
    const bytes = columnsToArrowBytes({ id: [] })
    vi.mocked(api.dataset.query).mockResolvedValue({ ok: true, value: bytes })

    mount()

    expect(await screen.findByText('Arquivo sem linhas de dado.')).toBeVisible()
  })

  it('renders NULL and empty string visibly differently, and formats bigint as text', async () => {
    const api = installApiMock()
    const bytes = columnsToArrowBytes({
      id: [1n, 2n],
      note: [null, '']
    })
    vi.mocked(api.dataset.query).mockResolvedValue({ ok: true, value: bytes })

    mount()

    expect(await screen.findByText('∅')).toBeVisible()
    expect(screen.getByText('1')).toBeVisible()
    const cells = screen.getAllByRole('cell')
    const emptyStringCell = cells.find((cell) => cell.textContent === '')
    expect(emptyStringCell).toBeDefined()
  })

  it('warns about truncation against part.rowCount, not a probed row count', async () => {
    const api = installApiMock()
    const bytes = columnsToArrowBytes({ id: Array.from({ length: 50 }, (_, i) => BigInt(i)) })
    vi.mocked(api.dataset.query).mockResolvedValue({ ok: true, value: bytes })

    mount({ ...PART, rowCount: 200 })

    expect(await screen.findByText('Mostrando as primeiras 50 de 200 linhas.')).toBeVisible()
  })

  it('shows no truncation warning when the file has 50 rows or fewer', async () => {
    const api = installApiMock()
    const bytes = columnsToArrowBytes({ id: [1n, 2n] })
    vi.mocked(api.dataset.query).mockResolvedValue({ ok: true, value: bytes })

    mount({ ...PART, rowCount: 2 })

    await screen.findByText('1')
    expect(screen.queryByText(/Mostrando as primeiras/)).not.toBeInTheDocument()
  })

  // The must-have invariant D18C.7 exists to protect: if the preview ever
  // rendered part.columns instead of the engine's own schema, a real
  // disagreement between scanDelimited and read_csv_auto would be hidden,
  // not shown.
  it('renders the columns the engine returned, not part.columns', async () => {
    const api = installApiMock()
    const bytes = columnsToArrowBytes({ engine_col_a: [1n], engine_col_b: [2n] })
    vi.mocked(api.dataset.query).mockResolvedValue({ ok: true, value: bytes })

    mount({ ...PART, columns: ['chrome_col_a', 'chrome_col_b'] })

    expect(await screen.findByText('engine_col_a')).toBeVisible()
    expect(screen.getByText('engine_col_b')).toBeVisible()
    expect(screen.queryByText('chrome_col_a')).not.toBeInTheDocument()
  })
})
