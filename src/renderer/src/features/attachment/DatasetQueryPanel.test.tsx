import { render, screen, waitFor } from '@testing-library/react'
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

    expect(await screen.findByText('mostrando as primeiras 200')).toBeVisible()
    expect(screen.getAllByRole('row')).toHaveLength(201) // 200 data rows + header
  })

  it('says how much came back and how long it took (DF3D.7)', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.query).mockResolvedValue({
      ok: true,
      value: columnsToArrowBytes({ id: [1n, 2n], name: ['Ana', 'Bruno'] })
    })
    const user = userEvent.setup()

    render(<DatasetQueryPanel hash="h1" />)
    await run(user)

    // The duration is real, so only its shape can be asserted.
    expect(await screen.findByText(/2 linhas · 2 colunas · \d+ ms/)).toBeVisible()
  })

  it('runs on Ctrl+Enter without touching the button', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.query).mockResolvedValue({
      ok: true,
      value: columnsToArrowBytes({ id: [1n] })
    })
    const user = userEvent.setup()

    render(<DatasetQueryPanel hash="h1" />)
    await user.click(screen.getByRole('textbox', { name: 'Consulta SQL' }))
    await user.keyboard('{Control>}{Enter}{/Control}')

    await waitFor(() => expect(api.dataset.query).toHaveBeenCalledOnce())
  })

  // The typo punished twice: the result being compared against disappears at
  // the exact moment the SQL goes wrong.
  it('keeps the last good result on screen when the next query fails', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.query).mockResolvedValue({
      ok: true,
      value: columnsToArrowBytes({ name: ['Ana'] })
    })
    const user = userEvent.setup()

    render(<DatasetQueryPanel hash="h1" />)
    await run(user)
    expect(await screen.findByText('Ana')).toBeVisible()

    vi.mocked(api.dataset.query).mockResolvedValue({
      ok: false,
      error: { kind: 'invalidQuery', message: 'Binder Error' }
    })
    await run(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Binder Error')
    expect(screen.getByText('Ana')).toBeVisible()
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
