import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ColumnProfile, DatasetPart } from '@shared/ipc'
import { columnsToArrowBytes } from '@core/duckdb/arrow'
import { installApiMock } from '@test/api-mock'
import { createQueryClient } from '../../shared/queryClient'
import ArtifactDataset from './ArtifactDataset'

const PART: DatasetPart = {
  kind: 'dataset',
  hash: 'h1',
  fileName: 'vendas.csv',
  format: 'delimited',
  delimiter: ',',
  columns: ['id', 'cidade'],
  rowCount: 8412
}

const PROFILE: ColumnProfile[] = [
  {
    column: 'cidade',
    type: 'VARCHAR',
    nullPercentage: 0,
    approxUnique: 2,
    min: 'Recife',
    max: 'São Paulo',
    avg: null,
    topValues: undefined
  }
]

function rows(count: number): Uint8Array {
  return columnsToArrowBytes({
    id: Array.from({ length: count }, (_, index) => index + 1),
    cidade: Array.from({ length: count }, () => 'Recife')
  })
}

function mount(): ReturnType<typeof installApiMock> {
  const api = installApiMock()
  vi.mocked(api.dataset.query).mockResolvedValue({ ok: true, value: rows(50) })
  vi.mocked(api.dataset.profile).mockResolvedValue({ ok: true, value: PROFILE })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ArtifactDataset part={PART} />
    </QueryClientProvider>
  )
  return api
}

describe('ArtifactDataset', () => {
  it('opens on the rows, with the range read from the file itself', async () => {
    mount()

    expect(await screen.findByRole('table')).toBeVisible()
    expect(screen.getByText('1–50 de 8.412')).toBeVisible()
  })

  it('asks for the profile only once its tab is reached', async () => {
    const api = mount()
    await screen.findByRole('table')

    expect(api.dataset.profile).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('tab', { name: 'Perfil' }))

    expect(await screen.findByText('cidade')).toBeVisible()
    expect(api.dataset.profile).toHaveBeenCalledWith('h1')
  })

  // The half of the pager that works today (DF3D.3): the cap is SQL text the
  // renderer writes, so no channel is involved.
  it('re-reads the file with the page size that was picked', async () => {
    const api = mount()
    await screen.findByRole('table')
    expect(api.dataset.query).toHaveBeenCalledWith('h1', 'SELECT * FROM dataset LIMIT 50')

    vi.mocked(api.dataset.query).mockResolvedValue({ ok: true, value: rows(25) })
    await userEvent.click(screen.getByRole('button', { name: '25' }))

    await waitFor(() =>
      expect(api.dataset.query).toHaveBeenCalledWith('h1', 'SELECT * FROM dataset LIMIT 25')
    )
    expect(await screen.findByText('1–25 de 8.412')).toBeVisible()
  })
})
