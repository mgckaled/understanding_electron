import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock } from '@test/api-mock'
import type { DatasetPart, Result } from '@shared/ipc'
import AttachButton from './AttachButton'

// jsdom's own default stylesheet forces `[popover]:not(:popover-open)` to
// `display: none` regardless of real state (see the shim in
// test/setup-renderer.ts) — every getByRole query into popover content needs
// `hidden: true` (getByText does not filter on display, so it needs none).
// The loading row (Lendo arquivo…/Cancelar) and the attached chip are NOT
// inside the popover (DS5.5) and need no such flag.
async function open(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Anexar arquivo' }))
}

const SUMMARY: DatasetPart = {
  kind: 'dataset',
  hash: 'h1',
  fileName: 'data.csv',
  delimiter: ',',
  columns: ['id', 'name'],
  rowCount: 42
}

function ControlledAttachButton(): React.JSX.Element {
  const [attachment, setAttachment] = useState<DatasetPart | null>(null)
  return (
    <AttachButton
      attachment={attachment}
      onAttached={setAttachment}
      onRemove={() => setAttachment(null)}
    />
  )
}

describe('AttachButton', () => {
  it('lifts the attached part to the caller and shows it as a chip', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.pick).mockResolvedValue({ ok: true, value: { path: '/data.csv' } })
    vi.mocked(api.dataset.attach).mockResolvedValue({ ok: true, value: SUMMARY })
    const user = userEvent.setup()

    render(<ControlledAttachButton />)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Escolher arquivo', hidden: true }))

    expect(await screen.findByText('data.csv')).toBeInTheDocument()
  })

  it('shows the schema summary when reopened after attaching', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.pick).mockResolvedValue({ ok: true, value: { path: '/data.csv' } })
    vi.mocked(api.dataset.attach).mockResolvedValue({ ok: true, value: SUMMARY })
    const user = userEvent.setup()

    render(<ControlledAttachButton />)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Escolher arquivo', hidden: true }))
    await screen.findByText('data.csv')
    await open(user)

    expect(screen.getByText('id, name')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('removing the chip clears the attachment', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.pick).mockResolvedValue({ ok: true, value: { path: '/data.csv' } })
    vi.mocked(api.dataset.attach).mockResolvedValue({ ok: true, value: SUMMARY })
    const user = userEvent.setup()

    render(<ControlledAttachButton />)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Escolher arquivo', hidden: true }))
    await screen.findByText('data.csv')

    await user.click(screen.getByRole('button', { name: 'Remover anexo' }))

    expect(screen.queryByText('data.csv')).not.toBeInTheDocument()
  })

  it('stays idle without an error when the dialog is closed', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.pick).mockResolvedValue({ ok: true, value: null })
    const user = userEvent.setup()

    render(<ControlledAttachButton />)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Escolher arquivo', hidden: true }))

    await waitFor(() => expect(api.dataset.pick).toHaveBeenCalledTimes(1))
    expect(api.dataset.attach).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert', { hidden: true })).not.toBeInTheDocument()
  })

  it('shows the not-found message from the error registry on attach failure', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.pick).mockResolvedValue({ ok: true, value: { path: '/gone.csv' } })
    vi.mocked(api.dataset.attach).mockResolvedValue({
      ok: false,
      error: { kind: 'not-found', path: '/gone.csv' }
    })
    const user = userEvent.setup()

    render(<ControlledAttachButton />)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Escolher arquivo', hidden: true }))
    await open(user)

    expect(await screen.findByRole('alert', { hidden: true })).toHaveTextContent(
      'Arquivo não encontrado.'
    )
  })

  it('calls job.cancel with the jobId used for the attach when cancelling mid-progress', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.pick).mockResolvedValue({ ok: true, value: { path: '/big.csv' } })
    vi.mocked(api.dataset.attach).mockReturnValue(new Promise<Result<DatasetPart>>(() => {}))
    const user = userEvent.setup()

    render(<ControlledAttachButton />)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Escolher arquivo', hidden: true }))
    // The row's own Cancelar, not inside the popover — visible even closed.
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))

    const usedJobId = vi.mocked(api.dataset.attach).mock.calls[0]?.[1]
    expect(api.job.cancel).toHaveBeenCalledWith(usedJobId)
  })

  it('unsubscribes from job events when unmounted during an operation', async () => {
    const api = installApiMock()
    const unsubscribe = vi.fn()
    vi.mocked(api.job.onEvent).mockReturnValue(unsubscribe)
    vi.mocked(api.dataset.pick).mockResolvedValue({ ok: true, value: { path: '/big.csv' } })
    vi.mocked(api.dataset.attach).mockReturnValue(new Promise<Result<DatasetPart>>(() => {}))
    const user = userEvent.setup()

    const { unmount } = render(<ControlledAttachButton />)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Escolher arquivo', hidden: true }))
    await screen.findByRole('button', { name: 'Cancelar' })

    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })
})
