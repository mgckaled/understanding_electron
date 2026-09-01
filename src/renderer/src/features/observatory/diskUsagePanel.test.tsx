import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock } from '@test/api-mock'
import type { DiskUsage } from '@shared/ipc'
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

describe('DiskUsagePanel', () => {
  it('mounts without sondando anything — only the button does', () => {
    const api = installApiMock()

    render(<DiskUsagePanel />)

    expect(api.disk.usage).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Sondar uso de disco' })).toBeInTheDocument()
  })

  it('sonda on click and shows the crivo/runtime split plus the total', async () => {
    const user = userEvent.setup()
    const api = installApiMock()
    vi.mocked(api.disk.usage).mockResolvedValue({ ok: true, value: USAGE })

    render(<DiskUsagePanel />)
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

    render(<DiskUsagePanel />)
    await user.click(screen.getByRole('button', { name: 'Sondar uso de disco' }))
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))

    expect(api.job.cancel).toHaveBeenCalledTimes(1)
  })

  it('shows a cancelled message, not a table, when the job comes back cancelled', async () => {
    const user = userEvent.setup()
    const api = installApiMock()
    vi.mocked(api.disk.usage).mockResolvedValue({ ok: false, error: { kind: 'cancelled' } })

    render(<DiskUsagePanel />)
    await user.click(screen.getByRole('button', { name: 'Sondar uso de disco' }))

    expect(await screen.findByText('Operação cancelada.')).toBeInTheDocument()
  })
})
