import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock } from '@test/api-mock'
import type { LoadedModel } from '@shared/ipc'
import type { ViewState } from '../../shared/ui/state'
import { createQueryClient } from '../../shared/queryClient'
import { useSystemMemory } from '../../shared/hooks/useSystemMemory'
import LoadedModels from './LoadedModels'

const RESIDENT: LoadedModel = {
  name: 'gemma3:4b',
  sizeBytes: 4_800_000_000,
  expiresAt: Date.now() + 4 * 60_000
}

function renderWithState(state: ViewState<LoadedModel[]>, onUnloaded = vi.fn()): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <LoadedModels state={state} onUnloaded={onUnloaded} />
    </QueryClientProvider>
  )
}

// Stands in for ConversationView, the observer that stays mounted behind the
// Observatório dialog in production (it is a sibling, not a route — D13.8)
// and is the reason `invalidateQueries(['app','memory'])` in LoadedModels'
// onSuccess is not vestigial: without an active observer of that key,
// invalidation only marks it stale, it never refetches.
function MemoryProbe(): null {
  useSystemMemory()
  return null
}

describe('LoadedModels', () => {
  it('lists what is resident, with its size and how long it has left', () => {
    renderWithState({ status: 'ready', data: [RESIDENT] })

    expect(screen.getByText('gemma3:4b')).toBeInTheDocument()
    expect(screen.getByText(/4,5 GB/)).toBeInTheDocument()
    expect(screen.getByText(/sai em ~4 min/)).toBeInTheDocument()
  })

  it('says so when nothing is loaded, instead of showing an empty box', () => {
    renderWithState({ status: 'empty' })

    expect(screen.getByText('Nenhum modelo carregado.')).toBeInTheDocument()
  })

  it('unloads the model and calls onUnloaded — the whole sondagem re-runs, not a private refetch', async () => {
    const user = userEvent.setup()
    const api = installApiMock()
    const onUnloaded = vi.fn()
    renderWithState({ status: 'ready', data: [RESIDENT] }, onUnloaded)

    await user.click(screen.getByRole('button', { name: 'Descarregar' }))

    await waitFor(() => expect(api.ai.unload).toHaveBeenCalledWith('ollama', 'gemma3:4b'))
    await waitFor(() => expect(onUnloaded).toHaveBeenCalled())
  })

  it('rereads free memory after unloading, because that is the whole point', async () => {
    const user = userEvent.setup()
    const api = installApiMock()
    const client = createQueryClient()
    render(
      <QueryClientProvider client={client}>
        <MemoryProbe />
        <LoadedModels state={{ status: 'ready', data: [RESIDENT] }} onUnloaded={vi.fn()} />
      </QueryClientProvider>
    )
    await waitFor(() => expect(api.app.memory).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'Descarregar' }))

    await waitFor(() => expect(api.ai.unload).toHaveBeenCalledWith('ollama', 'gemma3:4b'))
    await waitFor(() => expect(api.app.memory).toHaveBeenCalledTimes(2))
  })
})
