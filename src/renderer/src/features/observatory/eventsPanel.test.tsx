import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { installApiMock } from '@test/api-mock'
import type { EventRow } from '@shared/ipc'
import { createQueryClient } from '../../shared/queryClient'
import EventsPanel from './EventsPanel'

const ROWS: EventRow[] = [
  { channel: 'app:info', durationMs: 1.2, error: null, domainId: null, createdAt: Date.now() },
  {
    channel: 'ai:chat',
    durationMs: 800,
    error: 'provider down',
    domainId: 'conv-1',
    createdAt: Date.now()
  }
]

function renderPanel(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <EventsPanel />
    </QueryClientProvider>
  )
}

describe('EventsPanel', () => {
  it('shows the default retention window in the header', async () => {
    installApiMock()

    renderPanel()

    expect(await screen.findByText(/últimos 30 dias/)).toBeInTheDocument()
  })

  it('lists channel, error and domain id per row', async () => {
    const api = installApiMock()
    vi.mocked(api.events.list).mockResolvedValue(ROWS)

    renderPanel()

    expect(await screen.findByText('app:info')).toBeInTheDocument()
    const errorRow = screen.getByText('ai:chat').closest('tr')
    expect(errorRow).toHaveTextContent('provider down')
    expect(errorRow).toHaveTextContent('conv-1')
  })

  it('shows an error instead of a blank panel on failure', async () => {
    const api = installApiMock()
    vi.mocked(api.events.list).mockRejectedValue(new Error('boom'))

    renderPanel()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
