import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DatasetPart } from '@shared/ipc'
import { columnsToArrowBytes } from '@core/duckdb/arrow'
import { installApiMock } from '@test/api-mock'
import { createQueryClient } from '../../shared/queryClient'
import DatasetCard from './DatasetCard'

const PART: DatasetPart = {
  kind: 'dataset',
  hash: 'h1',
  fileName: 'clientes.csv',
  delimiter: ',',
  columns: ['id', 'nome'],
  rowCount: 10
}

function mount(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <DatasetCard part={PART} />
    </QueryClientProvider>
  )
}

describe('DatasetCard', () => {
  it('renders the preview automatically, with no click', async () => {
    const api = installApiMock()
    const bytes = columnsToArrowBytes({ id: [1n], nome: ['Ana'] })
    vi.mocked(api.dataset.query).mockResolvedValue({ ok: true, value: bytes })

    mount()

    expect(await screen.findByText('Ana')).toBeVisible()
    expect(api.dataset.query).toHaveBeenCalledWith('h1', 'SELECT * FROM dataset LIMIT 50')
  })

  it('keeps the Consultar toggle independent of the always-visible preview', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.query).mockResolvedValue({
      ok: true,
      value: columnsToArrowBytes({ id: [1n] })
    })
    const user = userEvent.setup()

    mount()
    await screen.findByText('1')
    expect(screen.queryByLabelText('Consulta SQL')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Consultar/ }))

    expect(screen.getByLabelText('Consulta SQL')).toBeInTheDocument()
  })
})
