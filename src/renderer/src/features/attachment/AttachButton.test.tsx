import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock, TEST_MODEL } from '@test/api-mock'
import type {
  AiModel,
  AttachmentPart,
  DatasetPart,
  DocumentPart,
  ImagePart,
  Result
} from '@shared/ipc'
import AttachButton from './AttachButton'

// jsdom's own default stylesheet forces `[popover]:not(:popover-open)` to
// `display: none` regardless of real state (see the shim in
// test/setup-renderer.ts) — every getByRole query into popover content needs
// `hidden: true` (getByText does not filter on display, so it needs none).
// The loading row (Lendo arquivo…/Cancelar) and the attached chip are NOT
// inside the popover (DS5.5) and need no such flag.
async function open(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Adicionar anexo' }))
}

const SUMMARY: DatasetPart = {
  kind: 'dataset',
  hash: 'h1',
  fileName: 'data.csv',
  delimiter: ',',
  columns: ['id', 'name'],
  rowCount: 42
}

const DOCUMENT: DocumentPart = {
  kind: 'document',
  hash: 'h2',
  fileName: 'especificacao.md',
  format: 'md',
  text: '# título\ncorpo do documento'
}

const IMAGE: ImagePart = {
  kind: 'image',
  hash: 'h3',
  fileName: 'grafico.png',
  mimeType: 'image/png'
}

/** No `vision` capability — the shape a caller passes for the disabled case. */
const NO_VISION: AiModel = { ...TEST_MODEL, capabilities: ['completion'] }

function ControlledAttachButton({ model = null }: { model?: AiModel | null }): React.JSX.Element {
  const [attachment, setAttachment] = useState<AttachmentPart | null>(null)
  return (
    <AttachButton
      attachment={attachment}
      onAttached={setAttachment}
      onRemove={() => setAttachment(null)}
      model={model}
    />
  )
}

describe('AttachButton', () => {
  it('lifts the attached dataset part to the caller and shows it as a chip', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.pick).mockResolvedValue({ ok: true, value: { path: '/data.csv' } })
    vi.mocked(api.dataset.attach).mockResolvedValue({ ok: true, value: SUMMARY })
    const user = userEvent.setup()

    render(<ControlledAttachButton />)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Dados tabulares', hidden: true }))

    expect(await screen.findByText('data.csv')).toBeInTheDocument()
  })

  it('shows the schema summary when reopened after attaching a dataset', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.pick).mockResolvedValue({ ok: true, value: { path: '/data.csv' } })
    vi.mocked(api.dataset.attach).mockResolvedValue({ ok: true, value: SUMMARY })
    const user = userEvent.setup()

    render(<ControlledAttachButton />)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Dados tabulares', hidden: true }))
    await screen.findByText('data.csv')
    await open(user)

    expect(screen.getByText('id, name')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('lifts the attached document part to the caller and shows it as a chip', async () => {
    const api = installApiMock()
    vi.mocked(api.document.pick).mockResolvedValue({ ok: true, value: { path: '/leia.md' } })
    vi.mocked(api.document.attach).mockResolvedValue({ ok: true, value: DOCUMENT })
    const user = userEvent.setup()

    render(<ControlledAttachButton />)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Documentos', hidden: true }))

    expect(await screen.findByText('especificacao.md')).toBeInTheDocument()
  })

  it('shows format and size when reopened after attaching a document', async () => {
    const api = installApiMock()
    vi.mocked(api.document.pick).mockResolvedValue({ ok: true, value: { path: '/leia.md' } })
    vi.mocked(api.document.attach).mockResolvedValue({ ok: true, value: DOCUMENT })
    const user = userEvent.setup()

    render(<ControlledAttachButton />)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Documentos', hidden: true }))
    await screen.findByText('especificacao.md')
    await open(user)

    expect(screen.getByText('MD')).toBeInTheDocument()
    expect(
      screen.getByText(`${DOCUMENT.text.length.toLocaleString('pt-BR')} caracteres`)
    ).toBeInTheDocument()
  })

  it("shows a time estimate in the progress label once the picked file is stat'd", async () => {
    const api = installApiMock()
    vi.mocked(api.document.pick).mockResolvedValue({
      ok: true,
      value: { path: '/grande.md', sizeBytes: 30_000 }
    })
    vi.mocked(api.document.attach).mockReturnValue(new Promise<Result<DocumentPart>>(() => {}))
    const user = userEvent.setup()

    render(<ControlledAttachButton />)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Documentos', hidden: true }))

    expect(await screen.findByText(/Lendo documento… ~\d+s/)).toBeInTheDocument()
  })

  it('removing the chip clears the attachment', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.pick).mockResolvedValue({ ok: true, value: { path: '/data.csv' } })
    vi.mocked(api.dataset.attach).mockResolvedValue({ ok: true, value: SUMMARY })
    const user = userEvent.setup()

    render(<ControlledAttachButton />)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Dados tabulares', hidden: true }))
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
    await user.click(screen.getByRole('button', { name: 'Dados tabulares', hidden: true }))

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
    await user.click(screen.getByRole('button', { name: 'Dados tabulares', hidden: true }))
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
    await user.click(screen.getByRole('button', { name: 'Dados tabulares', hidden: true }))
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
    await user.click(screen.getByRole('button', { name: 'Dados tabulares', hidden: true }))
    await screen.findByRole('button', { name: 'Cancelar' })

    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })

  // D17.11 — the compose-side half of the vision gate. The other half lives
  // in Composer's canSend.
  describe('the vision gate', () => {
    it('disables Imagens with a hint when no model is given', async () => {
      const user = userEvent.setup()
      installApiMock()

      render(<ControlledAttachButton />)
      await open(user)

      const item = screen.getByRole('button', { name: 'Imagens', hidden: true })
      expect(item).toBeDisabled()
      // A `title` on a disabled control is not a reliable surface (Chromium's
      // tooltip machinery may not fire on it) — the hint is this visible line.
      expect(
        screen.getByText('O modelo atual não processa imagens.', { selector: 'p' })
      ).toBeInTheDocument()
    })

    it('disables Imagens when the model has no vision capability', async () => {
      const user = userEvent.setup()
      installApiMock()

      render(<ControlledAttachButton model={NO_VISION} />)
      await open(user)

      expect(screen.getByRole('button', { name: 'Imagens', hidden: true })).toBeDisabled()
      expect(screen.getByText('O modelo atual não processa imagens.')).toBeInTheDocument()
    })

    it('enables Imagens and attaches when the model declares vision', async () => {
      const api = installApiMock()
      vi.mocked(api.image.pick).mockResolvedValue({ ok: true, value: { path: '/grafico.png' } })
      vi.mocked(api.image.attach).mockResolvedValue({ ok: true, value: IMAGE })
      const user = userEvent.setup()

      render(<ControlledAttachButton model={TEST_MODEL} />)
      await open(user)
      const item = screen.getByRole('button', { name: 'Imagens', hidden: true })
      expect(item).toBeEnabled()
      expect(screen.queryByText('O modelo atual não processa imagens.')).not.toBeInTheDocument()
      await user.click(item)

      expect(await screen.findByText('grafico.png')).toBeInTheDocument()
    })
  })
})
