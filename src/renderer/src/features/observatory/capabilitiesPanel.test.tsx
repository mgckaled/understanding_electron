import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock, TEST_MODEL } from '@test/api-mock'
import type { AiModel } from '@shared/ipc'
import { createQueryClient } from '../../shared/queryClient'
import CapabilitiesPanel from './CapabilitiesPanel'

const EMBEDDER: AiModel = {
  provider: 'ollama',
  name: 'nomic-embed-text:latest',
  parameterSize: '137M',
  sizeBytes: 274_000_000,
  capabilities: ['embedding'],
  contextLength: 2048,
  attention: null,
  variantOf: null
}

function renderPanel(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <CapabilitiesPanel />
    </QueryClientProvider>
  )
}

function mockHealthy(api: ReturnType<typeof installApiMock>): void {
  vi.mocked(api.ai.isAvailable).mockResolvedValue({
    ok: true,
    value: { service: 'ollama', version: '0.32.14' }
  })
  vi.mocked(api.ai.models).mockResolvedValue({ ok: true, value: [TEST_MODEL] })
  vi.mocked(api.secrets.has).mockResolvedValue(false)
}

describe('CapabilitiesPanel', () => {
  it('mounts without sondando anything — only the button does', () => {
    const api = installApiMock()
    mockHealthy(api)

    renderPanel()

    expect(api.ai.isAvailable).not.toHaveBeenCalled()
    expect(api.ai.models).not.toHaveBeenCalled()
    expect(api.ai.loaded).not.toHaveBeenCalled()
    expect(api.secrets.has).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Sondar capacidades' })).toBeInTheDocument()
  })

  it('sonda everything on click and shows the catalog', async () => {
    const user = userEvent.setup()
    const api = installApiMock()
    mockHealthy(api)

    renderPanel()
    await user.click(screen.getByRole('button', { name: 'Sondar capacidades' }))

    // The mock resolves the same catalog for all three services (DO4.1
    // covers one service per section), so the model name legitimately
    // appears three times — once per section, not a rendering bug.
    expect(await screen.findAllByText(TEST_MODEL.name)).toHaveLength(3)
    expect(api.ai.isAvailable).toHaveBeenCalledTimes(3)
    expect(api.ai.models).toHaveBeenCalledTimes(3)
    expect(api.ai.loaded).toHaveBeenCalledTimes(1)
    expect(api.secrets.has).toHaveBeenCalledTimes(2)
  })

  it('disables the initial button while the first sondagem is in flight', async () => {
    const user = userEvent.setup()
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockReturnValue(new Promise(() => {})) // never settles
    vi.mocked(api.ai.models).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.secrets.has).mockReturnValue(new Promise(() => {}))

    renderPanel()
    const button = screen.getByRole('button', { name: 'Sondar capacidades' })
    await user.click(button)

    expect(button).toBeDisabled()
  })

  // The initial button UNMOUNTS the moment data arrives — the ternary swaps
  // branch entirely, so it never comes back "enabled". The ↻ button is the
  // one that survives a refetch, and is where the disabled→enabled cycle is
  // actually observable.
  it('disables ↻ during a refetch, then re-enables once it settles', async () => {
    const user = userEvent.setup()
    const api = installApiMock()
    mockHealthy(api)

    renderPanel()
    await user.click(screen.getByRole('button', { name: 'Sondar capacidades' }))
    const refetchButton = await screen.findByRole('button', { name: 'Sondar capacidades de novo' })

    let resolveAll: (() => void) | undefined
    const pending = new Promise<{ ok: true; value: { service: 'ollama'; version: string } }>(
      (resolve) => {
        resolveAll = () => resolve({ ok: true, value: { service: 'ollama', version: '0.32.14' } })
      }
    )
    vi.mocked(api.ai.isAvailable).mockReturnValue(pending)

    await user.click(refetchButton)
    expect(refetchButton).toBeDisabled()

    resolveAll?.()
    await waitFor(() => expect(refetchButton).not.toBeDisabled())
  })

  it('↻ triggers a fresh sondagem, not a cached replay', async () => {
    const user = userEvent.setup()
    const api = installApiMock()
    mockHealthy(api)

    renderPanel()
    await user.click(screen.getByRole('button', { name: 'Sondar capacidades' }))
    await screen.findAllByText(TEST_MODEL.name)

    expect(api.ai.isAvailable).toHaveBeenCalledTimes(3)

    await user.click(screen.getByRole('button', { name: 'Sondar capacidades de novo' }))

    await waitFor(() => expect(api.ai.isAvailable).toHaveBeenCalledTimes(6))
  })

  it('keeps an embedder out of its own service table — it belongs to Embedder only', async () => {
    const user = userEvent.setup()
    const api = installApiMock()
    mockHealthy(api)
    vi.mocked(api.ai.models).mockImplementation(async (service) =>
      service === 'ollama' ? { ok: true, value: [TEST_MODEL, EMBEDDER] } : { ok: true, value: [] }
    )

    renderPanel()
    await user.click(screen.getByRole('button', { name: 'Sondar capacidades' }))
    await screen.findByText(TEST_MODEL.name)

    expect(screen.getAllByText(EMBEDDER.name)).toHaveLength(1)
    const embeddersHeading = screen.getByRole('heading', { name: 'Embedder' })
    expect(
      within(embeddersHeading.closest('section')!).getByText(EMBEDDER.name)
    ).toBeInTheDocument()
  })
})
