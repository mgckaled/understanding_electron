import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock } from '@test/api-mock'
import type { DiskUsage } from '@shared/ipc'
import { createQueryClient } from '../../shared/queryClient'
import DiskUsagePanel from './DiskUsagePanel'

const USAGE: DiskUsage = {
  crivo: [
    { name: 'crivo.db', bytes: 3 * 1024 * 1024, partial: false },
    { name: 'attachments', bytes: 40 * 1024 * 1024, partial: true }
  ],
  runtimeBytes: 121_452_694,
  runtimePartial: false,
  totalBytes: 3 * 1024 * 1024 + 40 * 1024 * 1024 + 121_452_694
}

function renderPanel(client: QueryClient = createQueryClient()): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={client}>
      <DiskUsagePanel />
    </QueryClientProvider>
  )
}

describe('DiskUsagePanel', () => {
  it('mounts without sondando anything — only the button does', () => {
    const api = installApiMock()

    renderPanel()

    expect(api.disk.usage).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Sondar uso de disco' })).toBeInTheDocument()
  })

  it('sonda on click and shows the crivo/runtime split plus the total', async () => {
    const user = userEvent.setup()
    const api = installApiMock()
    vi.mocked(api.disk.usage).mockResolvedValue({ ok: true, value: USAGE })

    renderPanel()
    await user.click(screen.getByRole('button', { name: 'Sondar uso de disco' }))

    expect(await screen.findByText('crivo.db')).toBeInTheDocument()
    expect(screen.getByText('Chromium (motor embutido)')).toBeInTheDocument()
    const attachmentsRow = screen.getByText('attachments').closest('tr')
    expect(attachmentsRow).toHaveTextContent('leitura parcial')
    expect(api.disk.usage).toHaveBeenCalledTimes(1)
  })

  it('cancels the in-flight job instead of waiting for it', async () => {
    const user = userEvent.setup()
    const api = installApiMock()
    vi.mocked(api.disk.usage).mockReturnValue(new Promise(() => {})) // never settles

    renderPanel()
    await user.click(screen.getByRole('button', { name: 'Sondar uso de disco' }))
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))

    expect(api.job.cancel).toHaveBeenCalledTimes(1)
  })

  it('shows a cancelled message, not a table, when the job comes back cancelled', async () => {
    const user = userEvent.setup()
    const api = installApiMock()
    vi.mocked(api.disk.usage).mockResolvedValue({ ok: false, error: { kind: 'cancelled' } })

    renderPanel()
    await user.click(screen.getByRole('button', { name: 'Sondar uso de disco' }))

    expect(await screen.findByText('Operação cancelada.')).toBeInTheDocument()
  })

  it('keeps the last measurement in the shared QueryClient cache across a remount', async () => {
    const user = userEvent.setup()
    const api = installApiMock()
    vi.mocked(api.disk.usage).mockResolvedValue({ ok: true, value: USAGE })
    const client = createQueryClient()

    const { unmount } = renderPanel(client)
    await user.click(screen.getByRole('button', { name: 'Sondar uso de disco' }))
    await screen.findByText('crivo.db')
    unmount()

    // §4.2: only the active observatory panel renders — switching away and
    // back unmounts and remounts this component. Without the QueryClient
    // cache backing the result, this second mount would show the button
    // again instead of the measurement (the bug this test guards).
    renderPanel(client)

    expect(await screen.findByText('crivo.db')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sondar uso de disco' })).not.toBeInTheDocument()
    expect(api.disk.usage).toHaveBeenCalledTimes(1)
  })
})
