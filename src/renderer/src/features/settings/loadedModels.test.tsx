import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock } from '@test/api-mock'
import type { Api } from '@shared/ipc'
import { createQueryClient } from '../../shared/queryClient'
import { useSystemMemory } from '../../shared/hooks/useSystemMemory'
import Settings from './Settings'

/*
 * Level 2 for the resident-model panel, brought forward from plano 17.
 *
 * The behaviour worth a test is not the list — it is that unloading invalidates
 * the MEMORY reading too. Without that, the button frees the weights and every
 * context ceiling on screen keeps quoting the old figure, which is the same
 * "advice the app does not honour" defect the RAM margin already produced once.
 */

const RESIDENT = {
  name: 'gemma3:4b',
  sizeBytes: 4_800_000_000,
  expiresAt: Date.now() + 4 * 60_000
}

/**
 * Subscribes to the free-memory query, the way ConversationView does behind the
 * modal. Without an active observer, `invalidateQueries` marks the entry stale
 * and refetches NOTHING — so the assertion below would be about the mutation's
 * bookkeeping instead of about the reading actually being redone.
 */
function MemoryProbe(): null {
  useSystemMemory()
  return null
}

function providers(children: ReactNode): React.JSX.Element {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <MemoryProbe />
      {children}
    </QueryClientProvider>
  )
}

function mount(): Api {
  const api = installApiMock()
  vi.mocked(api.ai.loaded).mockResolvedValue({ ok: true, value: [RESIDENT] })
  render(providers(<Settings />))
  return api
}

async function open(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Configurações' }))
}

describe('modelos em memória', () => {
  it('does not ask the provider anything until the modal is opened', async () => {
    // <dialog> keeps its children mounted while closed, and this query refetches
    // on mount — so a panel wired without the `open` guard would poll from boot.
    const api = mount()

    await waitFor(() => expect(api.settings.read).toHaveBeenCalled())
    expect(api.ai.loaded).not.toHaveBeenCalled()
  })

  it('lists what is resident, with its size and how long it has left', async () => {
    const user = userEvent.setup()
    mount()

    await open(user)

    expect(await screen.findByText('gemma3:4b')).toBeInTheDocument()
    expect(screen.getByText(/4,5 GB/)).toBeInTheDocument()
    expect(screen.getByText(/sai em ~4 min/)).toBeInTheDocument()
  })

  it('says so when nothing is loaded, instead of showing an empty box', async () => {
    const user = userEvent.setup()
    const api = installApiMock()
    vi.mocked(api.ai.loaded).mockResolvedValue({ ok: true, value: [] })
    render(providers(<Settings />))

    await open(user)

    expect(await screen.findByText('Nenhum modelo carregado.')).toBeInTheDocument()
  })

  it('rereads free memory after unloading, because that is the whole point', async () => {
    const user = userEvent.setup()
    const api = mount()
    await open(user)
    await screen.findByText('gemma3:4b')
    const before = vi.mocked(api.app.memory).mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Descarregar' }))

    await waitFor(() => expect(api.ai.unload).toHaveBeenCalledWith('ollama', 'gemma3:4b'))
    await waitFor(() => expect(vi.mocked(api.app.memory).mock.calls.length).toBeGreaterThan(before))
  })
})
