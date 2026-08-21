import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ColumnProfile } from '@shared/ipc'
import { installApiMock } from '@test/api-mock'
import { createQueryClient } from '../../shared/queryClient'
import DatasetProfile from './DatasetProfile'

function mount(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <DatasetProfile hash="h1" />
    </QueryClientProvider>
  )
}

describe('DatasetProfile', () => {
  it('never calls dataset:profile while closed', () => {
    const api = installApiMock()

    mount()

    expect(api.dataset.profile).not.toHaveBeenCalled()
  })

  it('opens, computes and renders low- and high-cardinality columns differently', async () => {
    const api = installApiMock()
    const profile: ColumnProfile[] = [
      {
        column: 'cidade',
        type: 'VARCHAR',
        nullPercentage: 0,
        approxUnique: 2,
        min: 'Recife',
        max: 'São Paulo',
        avg: null,
        topValues: [
          { value: 'São Paulo', count: 8 },
          { value: 'Recife', count: 2 }
        ]
      },
      {
        column: 'cpf',
        type: 'VARCHAR',
        nullPercentage: 0,
        approxUnique: 10,
        min: '00000000000',
        max: '99999999999',
        avg: null
      }
    ]
    vi.mocked(api.dataset.profile).mockResolvedValue({ ok: true, value: profile })
    const user = userEvent.setup()

    mount()
    await user.click(screen.getByRole('button', { name: /Perfil/ }))

    expect(await screen.findByText('cidade')).toBeVisible()
    expect(api.dataset.profile).toHaveBeenCalledWith('h1')
    expect(screen.getByText('São Paulo (8), Recife (2)')).toBeVisible()
    const cpfRow = screen.getByText('cpf').closest('tr')
    expect(cpfRow).not.toBeNull()
    expect(cpfRow).toHaveTextContent('—')
  })

  it('shows the engine error text for an invalidQuery result', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.profile).mockResolvedValue({
      ok: false,
      error: { kind: 'invalidQuery', message: 'Out of Memory Error' }
    })
    const user = userEvent.setup()

    mount()
    await user.click(screen.getByRole('button', { name: /Perfil/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Out of Memory Error')
  })
})
