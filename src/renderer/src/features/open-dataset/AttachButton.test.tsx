import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock } from '@test/api-mock'
import type { DatasetSummary, Result } from '@shared/ipc'
import AttachButton from './AttachButton'

// jsdom's own default stylesheet forces `[popover]:not(:popover-open)` to
// `display: none` regardless of real state (see the shim in
// test/setup-renderer.ts) — every query into popover content needs
// `hidden: true`. The loading row (Lendo arquivo…/Cancelar) is NOT inside the
// popover (DS5.5) and needs no such flag.
async function open(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Anexar arquivo' }))
}

describe('AttachButton', () => {
  it('shows the summary after picking and scanning successfully', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.pick).mockResolvedValue({ ok: true, value: { path: '/data.csv' } })
    vi.mocked(api.dataset.scan).mockResolvedValue({
      ok: true,
      value: { delimiter: ',', columns: ['id', 'name'], rowCount: 42 }
    })
    const user = userEvent.setup()

    render(<AttachButton />)
    await open(user)
    // Closes the popover before the native dialog opens (DS5.5) — reopen to
    // read the result back.
    await user.click(screen.getByRole('button', { name: 'Escolher arquivo', hidden: true }))
    await open(user)

    expect(
      await screen.findByText('id, name', { selector: '*', ignore: false })
    ).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('stays idle without an error when the dialog is closed', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.pick).mockResolvedValue({ ok: true, value: null })
    const user = userEvent.setup()

    render(<AttachButton />)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Escolher arquivo', hidden: true }))

    await waitFor(() => expect(api.dataset.pick).toHaveBeenCalledTimes(1))
    expect(api.dataset.scan).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert', { hidden: true })).not.toBeInTheDocument()
  })

  it('shows the not-found message from the error registry on scan failure', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.pick).mockResolvedValue({ ok: true, value: { path: '/gone.csv' } })
    vi.mocked(api.dataset.scan).mockResolvedValue({
      ok: false,
      error: { kind: 'not-found', path: '/gone.csv' }
    })
    const user = userEvent.setup()

    render(<AttachButton />)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Escolher arquivo', hidden: true }))
    await open(user)

    expect(await screen.findByRole('alert', { hidden: true })).toHaveTextContent(
      'Arquivo não encontrado.'
    )
  })

  it('calls job.cancel with the jobId used for the scan when cancelling mid-progress', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.pick).mockResolvedValue({ ok: true, value: { path: '/big.csv' } })
    vi.mocked(api.dataset.scan).mockReturnValue(new Promise<Result<DatasetSummary>>(() => {}))
    const user = userEvent.setup()

    render(<AttachButton />)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Escolher arquivo', hidden: true }))
    // The row's own Cancelar, not inside the popover — visible even closed.
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))

    const usedJobId = vi.mocked(api.dataset.scan).mock.calls[0]?.[1]
    expect(api.job.cancel).toHaveBeenCalledWith(usedJobId)
  })

  it('unsubscribes from job events when unmounted during an operation', async () => {
    const api = installApiMock()
    const unsubscribe = vi.fn()
    vi.mocked(api.job.onEvent).mockReturnValue(unsubscribe)
    vi.mocked(api.dataset.pick).mockResolvedValue({ ok: true, value: { path: '/big.csv' } })
    vi.mocked(api.dataset.scan).mockReturnValue(new Promise<Result<DatasetSummary>>(() => {}))
    const user = userEvent.setup()

    const { unmount } = render(<AttachButton />)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Escolher arquivo', hidden: true }))
    await screen.findByRole('button', { name: 'Cancelar' })

    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })
})
