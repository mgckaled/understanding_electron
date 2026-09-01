import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { installApiMock } from '@test/api-mock'
import type { PerformanceSummary } from '@shared/ipc'
import { createQueryClient } from '../../shared/queryClient'
import PerformancePanel from './PerformancePanel'

const SUMMARIES: PerformanceSummary[] = [
  {
    service: 'ollama',
    model: 'gemma3:4b',
    n: 12,
    avgTokensPerSec: 34.2,
    medianTokensPerSec: 33.1,
    p90TokensPerSec: 40.5,
    maxLoadDurationMs: 48_000
  },
  {
    service: 'glm',
    model: 'glm-4.5',
    n: 3,
    avgTokensPerSec: 60,
    medianTokensPerSec: 58,
    p90TokensPerSec: 70,
    maxLoadDurationMs: null
  }
]

function renderPanel(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <PerformancePanel />
    </QueryClientProvider>
  )
}

describe('PerformancePanel', () => {
  it('shows the default retention window in the header', async () => {
    installApiMock()

    renderPanel()

    expect(await screen.findByText(/últimos 30 dias/)).toBeInTheDocument()
  })

  it('lists model, n and tokens/s per bucket', async () => {
    const api = installApiMock()
    vi.mocked(api.performance.list).mockResolvedValue(SUMMARIES)

    renderPanel()

    expect(await screen.findByText('gemma3:4b')).toBeInTheDocument()
    const ollamaRow = screen.getByText('gemma3:4b').closest('tr')
    expect(ollamaRow).toHaveTextContent('12')
    expect(ollamaRow).toHaveTextContent('34,2 tok/s')
    expect(ollamaRow).toHaveTextContent('48,0s')
  })

  it('shows — for the load column when the bucket has no Ollama-native duration', async () => {
    const api = installApiMock()
    vi.mocked(api.performance.list).mockResolvedValue(SUMMARIES)

    renderPanel()

    const cloudRow = (await screen.findByText('glm-4.5')).closest('tr')
    expect(cloudRow).toHaveTextContent('—')
  })

  it('shows an error instead of a blank panel on failure', async () => {
    const api = installApiMock()
    vi.mocked(api.performance.list).mockRejectedValue(new Error('boom'))

    renderPanel()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
