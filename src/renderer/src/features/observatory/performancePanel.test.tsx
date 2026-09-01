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
    avgNetworkPrefillMs: 420,
    avgDecodeMs: 2_930,
    avgInputTokensPerSec: 180.4,
    avgOutputTokensPerSec: 34.2,
    medianOutputTokensPerSec: 33.1,
    p90OutputTokensPerSec: 40.5,
    maxLoadDurationMs: 48_000
  },
  {
    service: 'glm',
    model: 'glm-4.5',
    n: 3,
    avgNetworkPrefillMs: 900,
    avgDecodeMs: 1_200,
    avgInputTokensPerSec: null,
    avgOutputTokensPerSec: 60,
    medianOutputTokensPerSec: 58,
    p90OutputTokensPerSec: 70,
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

  it('lists model, n, the ttft/decode split and input/output tokens/s per bucket', async () => {
    const api = installApiMock()
    vi.mocked(api.performance.list).mockResolvedValue(SUMMARIES)

    renderPanel()

    expect(await screen.findByText('gemma3:4b')).toBeInTheDocument()
    const ollamaRow = screen.getByText('gemma3:4b').closest('tr')
    expect(ollamaRow).toHaveTextContent('12')
    expect(ollamaRow).toHaveTextContent('420ms')
    expect(ollamaRow).toHaveTextContent('2,9s')
    expect(ollamaRow).toHaveTextContent('180,4 tok/s')
    expect(ollamaRow).toHaveTextContent('34,2 tok/s')
    expect(ollamaRow).toHaveTextContent('48,0s')
  })

  it('shows — for input tok/s and the load column when the bucket has no Ollama-native fields', async () => {
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
