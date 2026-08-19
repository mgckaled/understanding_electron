import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { columnsToArrowBytes } from '@core/duckdb/arrow'
import { installApiMock } from '@test/api-mock'
import DatasetQueryPanel from './DatasetQueryPanel'

async function run(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Executar' }))
}

describe('DatasetQueryPanel', () => {
  it('runs the default query and renders the result table', async () => {
    const api = installApiMock()
    const bytes = columnsToArrowBytes({ id: [1n, 2n], name: ['Ana', 'Bruno'] })
    vi.mocked(api.dataset.query).mockResolvedValue({ ok: true, value: bytes })
    const user = userEvent.setup()

    render(<DatasetQueryPanel hash="h1" />)
    await run(user)

    expect(await screen.findByText('Ana')).toBeVisible()
    expect(screen.getByText('Bruno')).toBeVisible()
    expect(api.dataset.query).toHaveBeenCalledWith('h1', 'SELECT * FROM dataset')
  })

  it('shows the engine error text for an invalidQuery result', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.query).mockResolvedValue({
      ok: false,
      error: { kind: 'invalidQuery', message: 'Binder Error: column "x" not found' }
    })
    const user = userEvent.setup()

    render(<DatasetQueryPanel hash="h1" />)
    await run(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Binder Error: column "x" not found')
  })

  it('warns about truncation and caps the table at 200 rows when 201 come back', async () => {
    const api = installApiMock()
    const bytes = columnsToArrowBytes({
      id: Array.from({ length: 201 }, (_, i) => BigInt(i))
    })
    vi.mocked(api.dataset.query).mockResolvedValue({ ok: true, value: bytes })
    const user = userEvent.setup()

    render(<DatasetQueryPanel hash="h1" />)
    await run(user)

    expect(await screen.findByText('Mostrando as primeiras 200 linhas.')).toBeVisible()
    expect(screen.getAllByRole('row')).toHaveLength(201) // 200 data rows + header
  })

  it('renders NULL cells distinctly instead of an empty cell', async () => {
    const api = installApiMock()
    const bytes = columnsToArrowBytes({ note: [null] })
    vi.mocked(api.dataset.query).mockResolvedValue({ ok: true, value: bytes })
    const user = userEvent.setup()

    render(<DatasetQueryPanel hash="h1" />)
    await run(user)

    expect(await screen.findByText('∅')).toBeVisible()
  })
})
